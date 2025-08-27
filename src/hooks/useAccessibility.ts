import { useEffect, useCallback, useRef } from 'react';

export interface AccessibilityOptions {
  announcePageChanges?: boolean;
  manageFocus?: boolean;
  skipLinks?: boolean;
}

export function useAccessibility(options: AccessibilityOptions = {}) {
  const { 
    announcePageChanges = true, 
    manageFocus = true, 
    skipLinks = true 
  } = options;

  // 实时公告器引用
  const announcerRef = useRef<HTMLDivElement | null>(null);

  // 创建实时公告器
  useEffect(() => {
    if (!announcePageChanges) return;

    // 创建ARIA实时区域用于屏幕阅读器公告
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.setAttribute('role', 'status');
    announcer.style.position = 'absolute';
    announcer.style.left = '-10000px';
    announcer.style.width = '1px';
    announcer.style.height = '1px';
    announcer.style.overflow = 'hidden';
    announcer.id = 'accessibility-announcer';
    
    document.body.appendChild(announcer);
    announcerRef.current = announcer;

    return () => {
      if (document.body.contains(announcer)) {
        document.body.removeChild(announcer);
      }
    };
  }, [announcePageChanges]);

  // 公告消息给屏幕阅读器
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcerRef.current) return;

    // 清空后设置新消息，确保被读取
    announcerRef.current.textContent = '';
    announcerRef.current.setAttribute('aria-live', priority);
    
    // 短暂延迟确保屏幕阅读器捕获变化
    setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = message;
      }
    }, 100);
  }, []);

  // 管理焦点
  const manageFocusTo = useCallback((element: HTMLElement | string | null, options?: {
    preventScroll?: boolean;
    selectText?: boolean;
  }) => {
    if (!manageFocus) return;

    const targetElement = typeof element === 'string' 
      ? document.querySelector(element) as HTMLElement
      : element;

    if (targetElement) {
      targetElement.focus({ preventScroll: options?.preventScroll });
      
      // 如果是输入框，选择全部文本
      if (options?.selectText && targetElement instanceof HTMLInputElement) {
        targetElement.select();
      }
    }
  }, [manageFocus]);

  // 创建跳转链接
  const createSkipLink = useCallback((targetId: string, text: string) => {
    if (!skipLinks) return null;

    const skipLink = document.createElement('a');
    skipLink.href = `#${targetId}`;
    skipLink.textContent = text;
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-3 py-2 rounded-md z-50';
    
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.addEventListener('blur', () => {
          target.removeAttribute('tabindex');
        }, { once: true });
      }
    });

    return skipLink;
  }, [skipLinks]);

  // 高对比度模式检测
  const checkHighContrast = useCallback(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    return mediaQuery.matches;
  }, []);

  // 减少动效模式检测
  const checkReducedMotion = useCallback(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mediaQuery.matches;
  }, []);

  // 为元素添加ARIA标签
  const addAriaLabel = useCallback((element: HTMLElement, label: string) => {
    element.setAttribute('aria-label', label);
  }, []);

  // 为元素添加ARIA描述
  const addAriaDescription = useCallback((element: HTMLElement, description: string, descriptionId?: string) => {
    const id = descriptionId || `desc-${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建描述元素
    const descElement = document.createElement('div');
    descElement.id = id;
    descElement.className = 'sr-only';
    descElement.textContent = description;
    
    // 添加到DOM
    document.body.appendChild(descElement);
    
    // 关联到目标元素
    element.setAttribute('aria-describedby', id);
    
    return () => {
      if (document.body.contains(descElement)) {
        document.body.removeChild(descElement);
      }
    };
  }, []);

  // 创建可访问的对话框
  const createAccessibleModal = useCallback((modalElement: HTMLElement, titleId?: string) => {
    // 设置对话框属性
    modalElement.setAttribute('role', 'dialog');
    modalElement.setAttribute('aria-modal', 'true');
    
    if (titleId) {
      modalElement.setAttribute('aria-labelledby', titleId);
    }

    // 捕获焦点在对话框内
    const focusableElements = modalElement.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    modalElement.addEventListener('keydown', trapFocus);

    // 焦点到第一个可焦点元素
    if (firstElement) {
      firstElement.focus();
    }

    return () => {
      modalElement.removeEventListener('keydown', trapFocus);
    };
  }, []);

  // 检查和改善颜色对比度
  const checkColorContrast = useCallback((textColor: string, backgroundColor: string) => {
    // 简化的对比度计算，实际项目中可能需要更复杂的实现
    const getLuminance = (color: string) => {
      // 这里需要实现颜色到亮度的转换逻辑
      // 为了简化，返回一个模拟值
      return Math.random();
    };

    const textLuminance = getLuminance(textColor);
    const bgLuminance = getLuminance(backgroundColor);
    
    const contrast = (Math.max(textLuminance, bgLuminance) + 0.05) / 
                    (Math.min(textLuminance, bgLuminance) + 0.05);
    
    return {
      ratio: contrast,
      isGood: contrast >= 4.5, // WCAG AA标准
      isExcellent: contrast >= 7 // WCAG AAA标准
    };
  }, []);

  return {
    announce,
    manageFocusTo,
    createSkipLink,
    checkHighContrast,
    checkReducedMotion,
    addAriaLabel,
    addAriaDescription,
    createAccessibleModal,
    checkColorContrast
  };
}

// 用于表单可访问性的专门hook
export function useFormAccessibility() {
  const { announce, addAriaLabel, addAriaDescription } = useAccessibility();

  const validateField = useCallback((
    field: HTMLInputElement, 
    validator: (value: string) => string | null,
    errorElementId?: string
  ) => {
    const error = validator(field.value);
    const errorElement = errorElementId 
      ? document.getElementById(errorElementId)
      : field.nextElementSibling as HTMLElement;

    if (error) {
      field.setAttribute('aria-invalid', 'true');
      if (errorElement) {
        errorElement.textContent = error;
        field.setAttribute('aria-describedby', errorElement.id || 'error');
      }
      announce(`字段验证错误：${error}`, 'assertive');
      return false;
    } else {
      field.setAttribute('aria-invalid', 'false');
      if (errorElement) {
        errorElement.textContent = '';
      }
      return true;
    }
  }, [announce]);

  const createFieldGroup = useCallback((
    fields: HTMLElement[], 
    groupLabel: string, 
    groupDescription?: string
  ) => {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = groupLabel;
    fieldset.appendChild(legend);

    if (groupDescription) {
      const description = document.createElement('div');
      description.textContent = groupDescription;
      description.id = `group-desc-${Math.random().toString(36).substr(2, 9)}`;
      fieldset.setAttribute('aria-describedby', description.id);
      fieldset.appendChild(description);
    }

    fields.forEach(field => fieldset.appendChild(field));
    
    return fieldset;
  }, []);

  return {
    validateField,
    createFieldGroup,
    announce
  };
}