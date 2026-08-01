"use client";

import { ReactNode } from "react";

interface AnimatedContainerProps {
  children: ReactNode;
  className?: string;
  animation?: "fade" | "slide" | "scale" | "none";
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
}

export function AnimatedContainer({
  children,
  className = "",
  animation = "fade",
  direction = "up",
  duration = 0.3,
}: AnimatedContainerProps) {
  const getAnimationStyle = (): React.CSSProperties => {
    const durationMs = duration * 1000;
    
    switch (animation) {
      case "fade":
        return {
          animation: `fadeIn ${durationMs}ms ease-in-out`,
        };
      case "slide":
        const transform = direction === "left" ? "translateX(-20px)" 
          : direction === "right" ? "translateX(20px)"
          : direction === "up" ? "translateY(20px)"
          : "translateY(-20px)";
        return {
          animation: `slideIn ${durationMs}ms ease-in-out`,
          transform,
        };
      case "scale":
        return {
          animation: `scaleIn ${durationMs}ms ease-in-out`,
        };
      default:
        return {};
    }
  };

  return (
    <div
      className={className}
      style={getAnimationStyle()}
    >
      {children}
    </div>
  );
}

// CSS animations will be injected globally
if (typeof document !== "undefined") {
  const styleId = "animated-container-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { 
          opacity: 0; 
          transform: translateY(20px);
        }
        to { 
          opacity: 1; 
          transform: translateY(0);
        }
      }
      @keyframes scaleIn {
        from { 
          opacity: 0; 
          transform: scale(0.95);
        }
        to { 
          opacity: 1; 
          transform: scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  }
}
