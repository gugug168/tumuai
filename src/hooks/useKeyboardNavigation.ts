import { useEffect, useCallback } from 'react';

interface KeyboardNavigationOptions {
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onSpace?: () => void;
  onTab?: (shiftKey: boolean) => void;
  disabled?: boolean;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  const {
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onEnter,
    onEscape,
    onSpace,
    onTab,
    disabled = false
  } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    // 忽略在输入框或可编辑元素中的按键
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true') {
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
        if (onArrowUp) {
          event.preventDefault();
          onArrowUp();
        }
        break;

      case 'ArrowDown':
        if (onArrowDown) {
          event.preventDefault();
          onArrowDown();
        }
        break;

      case 'ArrowLeft':
        if (onArrowLeft) {
          event.preventDefault();
          onArrowLeft();
        }
        break;

      case 'ArrowRight':
        if (onArrowRight) {
          event.preventDefault();
          onArrowRight();
        }
        break;

      case 'Enter':
        if (onEnter) {
          event.preventDefault();
          onEnter();
        }
        break;

      case 'Escape':
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;

      case ' ':
      case 'Space':
        if (onSpace) {
          event.preventDefault();
          onSpace();
        }
        break;

      case 'Tab':
        if (onTab) {
          onTab(event.shiftKey);
        }
        break;
    }
  }, [onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onEnter, onEscape, onSpace, onTab, disabled]);

  useEffect(() => {
    if (disabled) return;

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, disabled]);

  // 辅助函数：获取所有可焦点元素
  const getFocusableElements = useCallback((container: HTMLElement = document.body) => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }, []);

  // 辅助函数：焦点到下一个元素
  const focusNext = useCallback(() => {
    const focusableElements = getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    focusableElements[nextIndex]?.focus();
  }, [getFocusableElements]);

  // 辅助函数：焦点到上一个元素
  const focusPrevious = useCallback(() => {
    const focusableElements = getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    const prevIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
    focusableElements[prevIndex]?.focus();
  }, [getFocusableElements]);

  return {
    getFocusableElements,
    focusNext,
    focusPrevious
  };
}

// 用于网格导航的专门hook
export function useGridNavigation(
  itemCount: number, 
  columnsCount: number,
  onItemSelect?: (index: number) => void
) {
  const currentIndex = 0; // 可以通过state管理当前选中项

  const moveUp = useCallback(() => {
    const newIndex = Math.max(0, currentIndex - columnsCount);
    console.log(`Grid navigation: moving up from ${currentIndex} to ${newIndex}`);
    // 这里可以设置新的currentIndex状态
  }, [currentIndex, columnsCount]);

  const moveDown = useCallback(() => {
    const newIndex = Math.min(itemCount - 1, currentIndex + columnsCount);
    console.log(`Grid navigation: moving down from ${currentIndex} to ${newIndex}`);
    // 这里可以设置新的currentIndex状态
  }, [currentIndex, columnsCount, itemCount]);

  const moveLeft = useCallback(() => {
    if (currentIndex % columnsCount > 0) {
      const newIndex = currentIndex - 1;
      console.log(`Grid navigation: moving left from ${currentIndex} to ${newIndex}`);
      // 这里可以设置新的currentIndex状态
    }
  }, [currentIndex, columnsCount]);

  const moveRight = useCallback(() => {
    if (currentIndex % columnsCount < columnsCount - 1 && currentIndex < itemCount - 1) {
      const newIndex = currentIndex + 1;
      console.log(`Grid navigation: moving right from ${currentIndex} to ${newIndex}`);
      // 这里可以设置新的currentIndex状态
    }
  }, [currentIndex, columnsCount, itemCount]);

  const selectCurrent = useCallback(() => {
    if (onItemSelect) {
      onItemSelect(currentIndex);
    }
  }, [currentIndex, onItemSelect]);

  useKeyboardNavigation({
    onArrowUp: moveUp,
    onArrowDown: moveDown,
    onArrowLeft: moveLeft,
    onArrowRight: moveRight,
    onEnter: selectCurrent,
    onSpace: selectCurrent
  });

  return {
    currentIndex,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    selectCurrent
  };
}