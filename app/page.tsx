import TeacherApp from '@/components/teacher-app';
import { MotionProvider } from '@/components/motion';
export default function Page() {
  return (
    <MotionProvider>
      <TeacherApp />
    </MotionProvider>
  );
}
