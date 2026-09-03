import { describe, expect, it } from 'vitest';
import { escapeHtml } from './format';

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
