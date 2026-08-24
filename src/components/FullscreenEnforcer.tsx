import { useState, useEffect, ReactNode } from 'react';
import { Card, Button } from './ui';
import { MaximizeIcon, AlertTriangleIcon } from './icons';

interface FullscreenEnforcerProps {
  children: ReactNode;
}

export default function FullscreenEnforcer({ children }: FullscreenEnforcerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Initial check
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error('Error attempting to enable fullscreen:', err);
      alert('Could not enable fullscreen. Please ensure your browser allows fullscreen mode.');
    }
  };

  if (isFullscreen) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-6 text-center">
      <Card className="max-w-md w-full p-8 bg-white border-red-100 shadow-2xl">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangleIcon className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold font-heading text-gray-900 mb-3">
          Fullscreen Required
        </h1>
        
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          To ensure a fair competition environment, this platform must be run in <strong>fullscreen mode</strong>. 
          <br /><br />
          If you are using any browser extensions (like AI assistants or ad blockers), please disable them now. Suspicious DOM modifications will be logged and flagged for review.
        </p>

        <Button 
          onClick={requestFullscreen} 
          className="w-full flex items-center justify-center gap-2 py-3 text-lg"
        >
          <MaximizeIcon className="w-5 h-5" />
          Enter Fullscreen to Start
        </Button>
      </Card>
    </div>
  );
}
