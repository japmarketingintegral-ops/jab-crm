import { describe, expect, it } from 'vitest';
import { escapeHtml, nivelVencimiento, formatearBytes } from './format';

describe('escapeHtml', () => {
  it('escapa las 5 entidades HTML básicas', () => {
    expect(escapeHtml(`<script>alert('hi') & "quotes"</script>`)).toBe(
      '&lt;script&gt;alert(&#39;hi&#39;) &amp; &quot;quotes&quot;&lt;/script&gt;',
    );
  });

  it('no toca texto sin caracteres especiales', () => {
    expect(escapeHtml('Reunión con el cliente el 5/9')).toBe('Reunión con el cliente el 5/9');
  });

  it('evita que un título de pedido inyecte una etiqueta en el email', () => {
    const titulo = '<img src=x onerror=alert(1)>';
    const escapado = escapeHtml(titulo);
    expect(escapado).not.toContain('<img');
    expect(escapado).toContain('&lt;img');
  });
});

describe('nivelVencimiento', () => {
  const ayer = new Date(Date.now() - 24 * 3_600_000).toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);
  const mañana = new Date(Date.now() + 24 * 3_600_000).toISOString().slice(0, 10);

  it('una fecha pasada sin estado es "vencida"', () => {
    expect(nivelVencimiento(ayer)).toBe('vencida');
  });

  it('un ítem ya aprobado nunca es "vencido", aunque su fecha programada haya pasado', () => {
    expect(nivelVencimiento(ayer, 'aprobado')).toBeNull();
  });

  it('un ítem aprobado con fecha de hoy tampoco se marca "vence hoy"', () => {
    expect(nivelVencimiento(hoy, 'aprobado')).toBeNull();
  });

  it('sin fecha programada es null, tenga o no estado', () => {
    expect(nivelVencimiento(null)).toBeNull();
    expect(nivelVencimiento(null, 'en_proceso')).toBeNull();
  });

  it('hoy y mañana con un estado no terminal se calculan normalmente', () => {
    expect(nivelVencimiento(hoy, 'en_proceso')).toBe('hoy');
    expect(nivelVencimiento(mañana, 'en_proceso')).toBe('proxima');
  });
});

describe('formatearBytes', () => {
  it('usa B, KB o MB según el tamaño', () => {
    expect(formatearBytes(500)).toBe('500 B');
    expect(formatearBytes(2048)).toBe('2 KB');
    expect(formatearBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('es "—" sin dato -- archivos subidos antes de registrar el tamaño', () => {
    expect(formatearBytes(null)).toBe('—');
  });
});
