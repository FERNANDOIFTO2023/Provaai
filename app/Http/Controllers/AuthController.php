<?php

namespace App\Http\Controllers;

use App\Mail\LoginCode;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function code(Request $r)
    {
        $data = $r->validate(['action' => 'required|in:request,verify', 'email' => 'required|email|max:254', 'code' => 'nullable|regex:/^\d{6,10}$/']);
        $email = mb_strtolower(trim($data['email']));

        return Cache::lock('login:'.hash('sha256', $email), 30)->block(5, function () use ($data, $email, $r) {
            $row = DB::table('login_codes')->where('email', $email)->first();
            if ($data['action'] === 'request') {
                if ($row && now()->lt($row->expires_at)) {
                    return response()->json(['reused' => true, 'expiresAt' => Carbon::parse($row->expires_at)->toIso8601String()]);
                }

                return $this->send($email);
            }
            if (! $row || now()->gte($row->expires_at)) {
                return response()->json(['error' => 'Código expirado. Solicite outro.', 'code' => 'expired_code'], 422);
            }
            if (! hash_equals($row->digest, $this->digest($email, $data['code'] ?? ''))) {
                if ($row->attempts >= 4) {
                    DB::table('login_codes')->where('email', $email)->delete();

                    return $this->send($email, true);
                }
                DB::table('login_codes')->where('email', $email)->increment('attempts');

                return response()->json(['error' => 'Código inválido. Confira o e-mail.', 'code' => 'invalid_code'], 422);
            }
            DB::table('login_codes')->where('email', $email)->update(['attempts' => 0]);
            $user = User::firstOrCreate(['email' => $email], ['name' => 'Professor', 'email_verified_at' => now()]);
            Auth::login($user);
            $r->session()->regenerate();
            $r->session()->put('activity_id', (string) Str::uuid());

            return response()->json(['session' => $this->sessionData($r)]);
        });
    }

    private function digest(string $email, string $code): string
    {
        return hash_hmac('sha256', $email.':'.$code, config('app.key'));
    }

    private function send(string $email, bool $rotated = false)
    {
        $key = 'email-send:'.hash('sha256', $email);
        if (RateLimiter::tooManyAttempts($key, 6)) {
            return response()->json(['error' => 'Limite de envios atingido. Aguarde antes de tentar novamente.', 'code' => 'send_limit'], 429);
        }
        RateLimiter::hit($key, 3600);
        $code = (string) random_int(100000, 999999);
        $expires = now()->addMinutes(LoginCode::VALID_FOR_MINUTES);
        try {
            Mail::to($email)->send(new LoginCode($code));
            DB::table('login_codes')->updateOrInsert(['email' => $email], ['digest' => $this->digest($email, $code), 'expires_at' => $expires, 'attempts' => 0, 'created_at' => now(), 'updated_at' => now()]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['error' => 'Não foi possível enviar o código. Tente novamente.', 'code' => 'send_failed'], 503);
        }

        return response()->json(['reused' => false, 'rotated' => $rotated, 'expiresAt' => $expires->toIso8601String()]);
    }

    public function session(Request $r)
    {
        return response()->json(['session' => $r->user() ? $this->sessionData($r) : null])->header('Cache-Control', 'no-store');
    }

    private function sessionData(Request $r): array
    {
        $user = $r->user();
        $id = $r->session()->get('activity_id');
        if (! $id) {
            $id = (string) Str::uuid();
            $r->session()->put('activity_id', $id);
        }
        // Identificador público para o relógio da interface, sem poder de autenticação.
        // A credencial real é apenas o cookie de sessão HttpOnly do Laravel.
        $marker = 'activity.'.rtrim(strtr(base64_encode(json_encode(['sub' => $user->id, 'session_id' => $id])), '+/', '-_'), '=').'.local';

        return ['access_token' => $marker, 'refresh_token' => '', 'user' => ['id' => $user->id, 'email' => $user->email, 'user_metadata' => ['full_name' => $user->name]]];
    }

    public function logout(Request $r)
    {
        Auth::logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }
}
