/// <reference types="@documenso/tsconfig/process-env.d.ts" />

declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}

type EnvironmentVariable = keyof NodeJS.ProcessEnv;

export const env = (variable: EnvironmentVariable | (string & object)): string | undefined => {
  if (typeof window !== 'undefined' && typeof window.__ENV__ === 'object') {
    return window.__ENV__[variable];
  }

  return process?.env?.[variable];
};

// Todo: Test
export const createPublicEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_PUBLIC_')));
