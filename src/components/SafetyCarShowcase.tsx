import React, { lazy, Suspense, useEffect, useState } from 'react';
import { supportsWebGL } from './CarShowcase';
import { ModelCredit } from './ModelCredit';

// [R55] El visor 3D del Safety Car es un módulo aparte: solo se descarga cuando sale el Safety Car y hay WebGL.
const SafetyCar3D = lazy(() => import('./SafetyCar3D'));

/** Safety Car en 3D para el aviso de carrera; sin WebGL no añade nada al aviso. */
export const SafetyCarShowcase: React.FC = () => {
  const [webgl, setWebgl] = useState(false);
  useEffect(() => { setWebgl(supportsWebGL()); }, []);
  return (
    <div data-safety-car-showcase={webgl ? '3d' : '2d'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {webgl && <Suspense fallback={null}><SafetyCar3D /></Suspense>}
      {webgl && <ModelCredit model="safetyCar" />}
    </div>
  );
};
