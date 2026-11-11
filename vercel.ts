const value = process.env.PROVAAI_ORIGIN;
if (!value) throw new Error('Configure PROVAAI_ORIGIN com a origem HTTPS da AWS neste ambiente da Vercel.');
const origin = new URL(value);
if (origin.protocol !== 'https:' || origin.origin !== value.replace(/\/$/, '') || origin.hostname.endsWith('.vercel.app')) {
  throw new Error('PROVAAI_ORIGIN deve apontar diretamente para o servidor HTTPS, sem caminho nem credenciais.');
}

// HTML, API e arquivos são servidos pela mesma versão do Laravel na AWS.
export const config = {
  framework: null,
  installCommand: 'node --version',
  buildCommand: 'node deploy/check-origin.mjs',
  outputDirectory: '.provaai-vercel',
  headers: ['/', '/api/:path*'].map(source => ({
    source,
    headers: [{key: 'Cache-Control', value: 'private, no-store'}],
  })),
  rewrites: [{ source: '/:path*', destination: origin.origin + '/:path*' }],
};
