import React, { useState, useRef, useEffect } from "react";
import "./CustomTooltip.css";

interface CustomTooltipProps {
    title: React.ReactNode;
    children: React.ReactElement;
    placement?: "top" | "bottom" | "left" | "right";
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ title, children, placement = "top" }) => {
    const [visible, setVisible] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const targetRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setVisible(true);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            setVisible(false);
        }, 100);
    };

    // Position the tooltip
    useEffect(() => {
        if (visible && tooltipRef.current && targetRef.current) {
            const targetRect = targetRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            let top = 0;
            let left = 0;

            switch (placement) {
                case "top":
                    top = targetRect.top - tooltipRect.height - 8;
                    left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
                    break;
                case "bottom":
                    top = targetRect.bottom + 8;
                    left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
                    break;
                case "left":
                    top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
                    left = targetRect.left - tooltipRect.width - 8;
                    break;
                case "right":
                    top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
                    left = targetRect.right + 8;
                    break;
            }

            // Ensure tooltip stays within viewport
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Adjust horizontal position
            if (left < 8) {
                left = 8;
            } else if (left + tooltipRect.width > viewportWidth - 8) {
                left = viewportWidth - tooltipRect.width - 8;
            }

            // Adjust vertical position
            if (top < 8) {
                top = 8;
            } else if (top + tooltipRect.height > viewportHeight - 8) {
                top = viewportHeight - tooltipRect.height - 8;
            }

            tooltipRef.current.style.top = `${top}px`;
            tooltipRef.current.style.left = `${left}px`;
        }
    }, [visible, placement]);

    // Clone the child element to add mouse event handlers
    const child = React.cloneElement(React.Children.only(children), {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        ref: targetRef,
    });

    return (
        <>
            {child}
            {visible && title && (
                <div
                    ref={tooltipRef}
                    className={`mx_CustomTooltip mx_CustomTooltip_${placement}`}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {title}
                </div>
            )}
        </>
    );
};

export default CustomTooltip;
