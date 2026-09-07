import { describe, expect, it } from 'vitest';
import { elegirImagenInstagram } from './meta';

describe('elegirImagenInstagram', () => {
  it('usa media_url para una foto (sin thumbnail_url)', () => {
    expect(elegirImagenInstagram({ media_url: 'https://cdninstagram.com/v/t51.foto.jpg' })).toBe(
      'https://cdninstagram.com/v/t51.foto.jpg',
    );
  });

  it('prioriza thumbnail_url para un reel/video -- media_url ahí es el archivo de video, no renderiza en un <img>', () => {
    expect(
      elegirImagenInstagram({
        media_url: 'https://cdninstagram.com/o/v/t2/f2/reel.mp4',
        thumbnail_url: 'https://cdninstagram.com/v/t51.miniatura.jpg',
      }),
    ).toBe('https://cdninstagram.com/v/t51.miniatura.jpg');
  });

  it('es null si Meta no devolvió ninguna de las dos', () => {
    expect(elegirImagenInstagram({})).toBeNull();
  });
});
