/**
 * WebGL support detection utility
 * Checks if the browser/device supports WebGL and required extensions
 */

export interface WebGLSupportResult {
  supported: boolean;
  error?: string;
  details?: {
    version: string;
    vendor: string;
    renderer: string;
  };
}

/**
 * Detect WebGL support and capabilities
 */
export function detectWebGLSupport(): WebGLSupportResult {
  try {
    const canvas = document.createElement('canvas');
    
    // Try WebGL 2 first, then WebGL 1
    const gl = canvas.getContext('webgl2') ||
               canvas.getContext('webgl') ||
               canvas.getContext('experimental-webgl');

    if (!gl) {
      return {
        supported: false,
        error: 'WebGL is not supported by your browser or device. Please use a modern browser like Chrome, Firefox, or Edge.',
      };
    }

    // Type guard for WebGL contexts
    if (!(gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext)) {
      return {
        supported: false,
        error: 'WebGL context could not be created.',
      };
    }

    // Check WebGL version
    const isWebGL2 = gl instanceof WebGL2RenderingContext;
    const version = isWebGL2 ? 'WebGL 2.0' : 'WebGL 1.0';

    // Get renderer info
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo ? gl.getParameter((debugInfo as any).UNMASKED_VENDOR_WEBGL) : 'Unknown';
    const renderer = debugInfo ? gl.getParameter((debugInfo as any).UNMASKED_RENDERER_WEBGL) : 'Unknown';

    // Check for required extensions (WebGL 1 only, WebGL 2 has these built-in)
    if (!isWebGL2) {
      const requiredExtensions = [
        'OES_texture_float',
        'OES_element_index_uint',
      ];

      for (const ext of requiredExtensions) {
        if (!gl.getExtension(ext)) {
          return {
            supported: false,
            error: `Required WebGL extension "${ext}" is not available. Your device may not support advanced graphics features.`,
          };
        }
      }
    }

    // Check max texture size (PixiJS requires at least 2048)
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (maxTextureSize < 2048) {
      return {
        supported: false,
        error: `WebGL max texture size (${maxTextureSize}) is too small. Minimum required: 2048.`,
      };
    }

    console.log('✅ WebGL Support Detected:', {
      version,
      vendor,
      renderer,
      maxTextureSize,
    });

    return {
      supported: true,
      details: {
        version,
        vendor,
        renderer,
      },
    };
  } catch (e) {
    console.error('WebGL detection error:', e);
    return {
      supported: false,
      error: 'Failed to initialize WebGL context. Your browser or device may not support hardware acceleration.',
    };
  }
}

/**
 * Get a user-friendly error message with suggestions
 */
export function getWebGLErrorMessage(result: WebGLSupportResult): string {
  if (result.supported) return '';

  const baseMessage = result.error || 'WebGL is not supported.';
  
  const suggestions = [
    'Try using a modern browser (Chrome, Firefox, Edge, Safari)',
    'Update your graphics drivers',
    'Enable hardware acceleration in browser settings',
    'Try a different device if the issue persists',
  ];

  return `${baseMessage}\n\nSuggestions:\n${suggestions.map(s => `• ${s}`).join('\n')}`;
}

