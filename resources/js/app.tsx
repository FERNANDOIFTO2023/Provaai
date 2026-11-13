import React from 'react';
import { createRoot } from 'react-dom/client';
import TeacherApp from '../../components/teacher-app';
import { MotionProvider } from '../../components/motion';
import '../css/sala.css';
import '../css/bloub.css';
import '../css/icon-motion.css';
import '../css/class-appearance.css';
import '../css/workspace-header.css';
import '../css/collections.css';
createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <MotionProvider>
      <TeacherApp />
    </MotionProvider>
  </React.StrictMode>,
);
