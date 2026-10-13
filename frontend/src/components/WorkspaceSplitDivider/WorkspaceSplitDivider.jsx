import './WorkspaceSplitDivider.css';
import { useState, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  GripVertical,
  GripHorizontal,
  Code2,
  Play
} from 'lucide-react';

/**
 * WorkspaceSplitDivider
 * Provides a professional draggable divider with interactive arrow-icon controls
 * between Monaco Code Editor and Live Preview.
 */
export default function WorkspaceSplitDivider({
  containerRef,
  splitRatio = 50,
  onSplitChange,
  maximizedPane = 'none', // 'none' | 'editor' | 'preview'
  onMaximizeEditor,
  onMaximizePreview,
  onResetSplit,
  isVertical = false, // false = horizontal split (vertical divider bar), true = vertical split (horizontal divider bar)
  onDragStart,
  onDragEnd
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dividerRef = useRef(null);

  // Dragging logic
  const handlePointerDown = useCallback(
    (e) => {
      // Don't start drag if clicked on a button
      if (e.target.closest('button')) return;

      e.preventDefault();
      setIsDragging(true);
      if (onDragStart) onDragStart();

      const container = containerRef?.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      const handlePointerMove = (moveEvent) => {
        const clientX = moveEvent.clientX ?? moveEvent.touches?.[0]?.clientX;
        const clientY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;

        if (clientX === undefined || clientY === undefined) return;

        let newRatio;
        if (!isVertical) {
          const offsetX = clientX - rect.left;
          newRatio = (offsetX / rect.width) * 100;
        } else {
          const offsetY = clientY - rect.top;
          newRatio = (offsetY / rect.height) * 100;
        }

        // Clamp between 15% and 85%
        const clampedRatio = Math.min(Math.max(newRatio, 15), 85);
        if (onSplitChange) {
          onSplitChange(Math.round(clampedRatio * 10) / 10);
        }
      };

      const handlePointerUp = () => {
        setIsDragging(false);
        if (onDragEnd) onDragEnd();
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('touchmove', handlePointerMove);
        window.removeEventListener('touchend', handlePointerUp);
        window.removeEventListener('touchcancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
      window.addEventListener('touchcancel', handlePointerUp);
    },
    [containerRef, isVertical, onDragStart, onDragEnd, onSplitChange]
  );

  // Keyboard navigation for accessibility
  const handleKeyDown = (e) => {
    let delta = 0;
    if (!isVertical) {
      if (e.key === 'ArrowLeft') delta = -5;
      if (e.key === 'ArrowRight') delta = 5;
    } else {
      if (e.key === 'ArrowUp') delta = -5;
      if (e.key === 'ArrowDown') delta = 5;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      if (onSplitChange) onSplitChange(15);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      if (onSplitChange) onSplitChange(85);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onResetSplit) onResetSplit();
      return;
    }

    if (delta !== 0) {
      e.preventDefault();
      const newRatio = Math.min(Math.max(splitRatio + delta, 15), 85);
      if (onSplitChange) onSplitChange(newRatio);
    }
  };

  // Double click resets to 50/50
  const handleDoubleClick = (e) => {
    if (e.target.closest('button')) return;
    if (onResetSplit) onResetSplit();
  };

  // If Editor is maximized (Preview is collapsed), render a docked restore rail on right
  if (maximizedPane === 'editor') {
    return (
      <div
        className={`split-docked-rail docked-right ${isVertical ? 'docked-bottom' : ''}`}
        title="Live Preview is collapsed"
      >
        <button
          type="button"
          className="btn-docked-restore"
          onClick={onResetSplit}
          aria-label="Restore Live Preview"
          title="Restore Live Preview"
        >
          {isVertical ? <ChevronUp size={14} /> : <ChevronLeft size={14} />}
          <Play size={12} className="docked-icon" />
          <span className="docked-text">Preview</span>
        </button>
      </div>
    );
  }

  // If Preview is maximized (Editor is collapsed), render a docked restore rail on left
  if (maximizedPane === 'preview') {
    return (
      <div
        className={`split-docked-rail docked-left ${isVertical ? 'docked-top' : ''}`}
        title="Code Editor is collapsed"
      >
        <button
          type="button"
          className="btn-docked-restore"
          onClick={onResetSplit}
          aria-label="Restore Code Editor"
          title="Restore Code Editor"
        >
          {isVertical ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Code2 size={12} className="docked-icon" />
          <span className="docked-text">Editor</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={dividerRef}
      className={`workspace-split-divider ${isVertical ? 'orientation-vertical' : 'orientation-horizontal'} ${
        isDragging ? 'is-dragging' : ''
      }`}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      role="separator"
      tabIndex={0}
      aria-orientation={isVertical ? 'horizontal' : 'vertical'}
      aria-valuenow={Math.round(splitRatio)}
      aria-valuemin={15}
      aria-valuemax={85}
      aria-label="Workspace split resizer between Monaco Editor and Live Preview"
      title={`Drag to resize or use arrow buttons (Current: ${Math.round(splitRatio)}% / ${Math.round(
        100 - splitRatio
      )}%)`}
    >
      {/* Invisible expanded hit area for touch/click ergonomics */}
      <div className="split-divider-hitbox" />

      {/* Visual divider line track */}
      <div className="split-divider-line" />

      {/* Centered arrow-icon controls handle pill */}
      <div
        className="split-controls-handle"
        onPointerDown={(e) => e.stopPropagation()} // Allow clicking buttons without triggering drag
      >
        {!isVertical ? (
          <>
            {/* Collapse Editor -> Maximize Live Preview */}
            <button
              type="button"
              className="split-handle-btn btn-collapse-left"
              onClick={onMaximizePreview}
              title="Maximize Live Preview (Collapse Editor)"
              aria-label="Maximize Live Preview"
            >
              <ChevronLeft size={13} />
            </button>

            {/* Reset 50/50 balance */}
            <button
              type="button"
              className="split-handle-btn btn-reset-split"
              onClick={onResetSplit}
              title={`Reset 50/50 Split (${Math.round(splitRatio)}% / ${Math.round(100 - splitRatio)}%)`}
              aria-label="Reset 50/50 Split"
            >
              <GripVertical size={13} />
            </button>

            {/* Collapse Live Preview -> Maximize Editor */}
            <button
              type="button"
              className="split-handle-btn btn-collapse-right"
              onClick={onMaximizeEditor}
              title="Maximize Code Editor (Collapse Preview)"
              aria-label="Maximize Code Editor"
            >
              <ChevronRight size={13} />
            </button>
          </>
        ) : (
          <>
            {/* Vertical mode: Up -> Maximize Editor */}
            <button
              type="button"
              className="split-handle-btn btn-collapse-up"
              onClick={onMaximizeEditor}
              title="Maximize Code Editor"
              aria-label="Maximize Code Editor"
            >
              <ChevronUp size={13} />
            </button>

            {/* Reset 50/50 balance */}
            <button
              type="button"
              className="split-handle-btn btn-reset-split"
              onClick={onResetSplit}
              title={`Reset 50/50 Split (${Math.round(splitRatio)}% / ${Math.round(100 - splitRatio)}%)`}
              aria-label="Reset 50/50 Split"
            >
              <GripHorizontal size={13} />
            </button>

            {/* Vertical mode: Down -> Maximize Preview */}
            <button
              type="button"
              className="split-handle-btn btn-collapse-down"
              onClick={onMaximizePreview}
              title="Maximize Live Preview"
              aria-label="Maximize Live Preview"
            >
              <ChevronDown size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
