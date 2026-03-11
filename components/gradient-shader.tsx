import * as THREE from 'three'

export function createGradientMaterial(gradientSettings: {
  enabled: boolean
  type: "radial" | "linear"
  color1: string
  color2: string
  color3?: string
  use3Colors?: boolean
  intensity: number
  distortion: number
  angle?: number
  noise?: number
}) {
  if (!gradientSettings.enabled) {
    return null
  }
  
  const useThreeColors = gradientSettings.use3Colors || false

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vViewPosition = normalize(position - cameraPosition);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    uniform float intensity;
    uniform float distortion;
    uniform int gradientType; // 0 = radial, 1 = linear
    uniform bool useThreeColors;
    uniform float angle; // угол поворота для линейного градиента (в радианах)
    uniform float noise; // интенсивность шума

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;

    // Простая функция шума на основе sin/cos
    float simpleNoise(vec3 p) {
      return sin(p.x * 12.9898 + p.y * 78.233 + p.z * 45.164) * 43758.5453;
    }

    // Функция для преобразования RGB в HSL
    vec3 rgb2hsl(vec3 c) {
      float maxc = max(max(c.r, c.g), c.b);
      float minc = min(min(c.r, c.g), c.b);
      float l = (maxc + minc) / 2.0;
      float h = 0.0;
      float s = 0.0;
      
      if (maxc != minc) {
        float d = maxc - minc;
        s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
        
        if (maxc == c.r) {
          h = mod((c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0), 6.0) / 6.0;
        } else if (maxc == c.g) {
          h = ((c.b - c.r) / d + 2.0) / 6.0;
        } else {
          h = ((c.r - c.g) / d + 4.0) / 6.0;
        }
      }
      return vec3(h, s, l);
    }

    // Функция для преобразования HSL в RGB
    vec3 hsl2rgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
    }

    // Гамма-коррекция
    vec3 toLinear(vec3 c) {
      return pow(c, vec3(2.2));
    }

    vec3 toSRGB(vec3 c) {
      return pow(c, vec3(1.0 / 2.2));
    }

    void main() {
      float gradient = 0.0;
      
      if (gradientType == 0) {
        // Radial gradient - улучшенная версия
        vec3 normalizedPos = normalize(vPosition);
        gradient = length(normalizedPos) * 0.5;
        
        // Добавляем волнистый эффект с лучшей амплитудой
        gradient += sin(vNormal.x * 3.14159 + distortion * 5.0) * distortion * 0.4;
        gradient += cos(vNormal.y * 2.5 + distortion * 3.0) * distortion * 0.2;
      } else {
        // Linear gradient - применяем угол поворота
        vec3 rotatedPos = vPosition;
        float cosAngle = cos(angle);
        float sinAngle = sin(angle);
        // Применяем матрицу поворота для позиции
        rotatedPos.x = vPosition.x * cosAngle - vPosition.y * sinAngle;
        rotatedPos.y = vPosition.x * sinAngle + vPosition.y * cosAngle;
        
        // Нормализуем координаты
        gradient = (rotatedPos.y + 1.0) * 0.5;
        
        // Добавляем distortion отдельно, не влияя на базовое распределение
        float distortionEffect = sin(vNormal.z * 3.14159 + distortion * 5.0) * distortion * 0.15;
        distortionEffect += cos(vNormal.x * 2.5 + distortion * 3.0) * distortion * 0.1;
        gradient += distortionEffect;
      }

      gradient = clamp(gradient, 0.0, 1.0);

      // Используем кубическую интерполяцию для более плавных переходов
      float easedGradient = gradient * gradient * (3.0 - 2.0 * gradient);

      vec3 finalColor;
      if (useThreeColors) {
        // Плавная интерполяция через три цвета
        if (easedGradient < 0.5) {
          finalColor = mix(color1, color2, easedGradient * 2.0);
        } else {
          finalColor = mix(color2, color3, (easedGradient - 0.5) * 2.0);
        }
      } else {
        finalColor = mix(color1, color2, easedGradient);
      }

      // Преобразуем в HSL для увеличения насыщенности
      vec3 hsl = rgb2hsl(finalColor);
      // Увеличиваем насыщенность на 30%
      hsl.y = clamp(hsl.y * 1.3, 0.0, 1.0);
      // Немного сдвигаем яркость для контрастности
      hsl.z = clamp(hsl.z * 1.1, 0.0, 1.0);
      finalColor = hsl2rgb(hsl);

      // Добавляем эффект передачи света через материал
      vec3 normal = normalize(vNormal);
      float fresnel = pow(1.0 - abs(dot(normal, vViewPosition)), 2.5);
      
      // Более выраженный fresnel эффект
      finalColor += vec3(fresnel * distortion * 0.7);

      // Гамма-коррекция для лучшей визуальной четкости
      finalColor = toSRGB(toLinear(finalColor) * intensity);

      // Добавляем шум к финальному цвету
      if (noise > 0.0) {
        float noiseVal = fract(simpleNoise(vPosition * 5.0)) - 0.5;
        float noiseVal2 = fract(simpleNoise(vPosition * 10.0 + vec3(5.0))) - 0.5;
        float noiseVal3 = fract(simpleNoise(vPosition * 20.0 + vec3(10.0))) - 0.5;
        
        // Комбинируем несколько октав шума
        float combinedNoise = noiseVal * 0.5 + noiseVal2 * 0.3 + noiseVal3 * 0.2;
        
        // Применяем шум к цвету
        finalColor += vec3(combinedNoise) * noise * 0.15;
      }

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `

  const c1 = new THREE.Color(gradientSettings.color1)
  const c2 = new THREE.Color(gradientSettings.color2)
  const c3 = new THREE.Color(gradientSettings.color3 || gradientSettings.color1)

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      color1: { value: c1 },
      color2: { value: c2 },
      color3: { value: c3 },
      intensity: { value: gradientSettings.intensity },
      distortion: { value: gradientSettings.distortion },
      gradientType: { value: gradientSettings.type === "radial" ? 0 : 1 },
      useThreeColors: { value: useThreeColors },
      angle: { value: gradientSettings.angle || 0 },
      noise: { value: gradientSettings.noise || 0 },
    },
    side: THREE.FrontSide,
  })

  return material
}
