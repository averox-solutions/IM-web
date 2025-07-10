import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './CallModal.css';

interface CustomModalProps {
  title?: React.ReactNode;
  open: boolean;
  footer?: React.ReactNode;
  closable?: boolean;
  width?: string | number;
  className?: string;
  centered?: boolean;
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * Custom modal component that doesn't rely on Ant Design
 * Provides similar API to Ant Design Modal for easy replacement
 */
const CustomModal: React.FC<CustomModalProps> = ({
  title,
  open,
  footer,
  closable = true,
  width = 520,
  className = '',
  centered = false,
  children,
  onClose
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Create portal container if it doesn't exist
  useEffect(() => {
    if (!document.getElementById('mx_CustomModal_Container')) {
      const container = document.createElement('div');
      container.id = 'mx_CustomModal_Container';
      document.body.appendChild(container);
    }
    
    // Add body class to prevent scrolling
    if (open) {
      document.body.classList.add('modal-open');
    }
    
    // Clean up
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open]);
  
  // Handle ESC key to close modal if closable
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable && onClose) {
        e.preventDefault();
        onClose();
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closable, onClose]);
  
  // Handle click outside to close modal if closable
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && closable && onClose) {
        onClose();
      }
    };
    
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, closable, onClose]);
  
  if (!open) return null;
  
  const modalStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
  };
  
  const modalContent = (
    <div className="mx_CustomModal_wrapper">
      <div className="mx_CustomModal_backdrop"></div>
      <div className={`mx_CustomModal ${centered ? 'mx_CustomModal_centered' : ''}`}>
        <div 
          ref={modalRef}
          className={`mx_CustomModal_content ${className}`} 
          style={modalStyle}
          role="dialog"
          aria-modal="true"
        >
          {closable && onClose && (
            <button 
              className="mx_CustomModal_closeButton" 
              aria-label="Close" 
              onClick={onClose}
            >
              ×
            </button>
          )}
          {title && <div className="mx_CustomModal_header">{title}</div>}
          <div className="mx_CustomModal_body">
            {children}
          </div>
          {footer && <div className="mx_CustomModal_footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
  
  return ReactDOM.createPortal(
    modalContent,
    document.getElementById('mx_CustomModal_Container') || document.body
  );
};

export default CustomModal; 