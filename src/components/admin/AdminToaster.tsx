'use client';

import { Toaster } from 'react-hot-toast';
import { ADMIN_TOASTER_ID } from '@/lib/adminToast';

export function AdminToaster() {
  return (
    <Toaster
      toasterId={ADMIN_TOASTER_ID}
      position="top-right"
      containerStyle={{ top: 16, right: 16, zIndex: 99999 }}
      toastOptions={{
        style: {
          background: 'transparent',
          boxShadow: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
        },
      }}
    />
  );
}
