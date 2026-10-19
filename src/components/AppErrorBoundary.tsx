// [N10] Paracaídas de errores: si algo falla al pintar la aplicación (en la prueba entre redes, una foto incompleta
// tiraba la del invitado y la dejaba en negro), se ve un aviso con la salida en vez de una pantalla vacía.
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Fallo en la aplicación', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: '24px 16px', textAlign: 'center', background: 'var(--bg, #0d1117)', color: 'var(--text, #e6edf3)', fontFamily: 'var(--font-ui, sans-serif)',
      }}>
        <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Algo ha fallado</p>
        <p style={{ margin: 0, maxWidth: 420, color: 'var(--text-2, #9da7b3)' }}>La pantalla no se ha podido pintar. Si estabas en una sala, vuelve a entrar con el mismo enlace: recuperas tu sitio.</p>
        <code style={{ fontSize: 14, maxWidth: 420, overflowWrap: 'anywhere', color: 'var(--text-3, #7d8590)' }}>{error.message}</code>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={() => location.reload()} style={{ minHeight: 44, padding: '8px 18px', fontSize: 16 }}>Recargar</button>
          <button type="button" onClick={() => { location.href = location.pathname; }} style={{ minHeight: 44, padding: '8px 18px', fontSize: 16 }}>Volver al menú</button>
        </div>
      </div>
    );
  }
}
