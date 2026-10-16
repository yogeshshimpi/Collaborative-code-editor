import './ProjectTypeSelector.css';
import { PROJECT_TYPES } from '../../constants/projectTypes';
import { Check } from 'lucide-react';

export default function ProjectTypeSelector({ selectedType = 'html', onChange, disabled = false }) {
  return (
    <div className="project-type-selector-wrapper">
      <div className="project-type-label-row">
        <label className="project-type-label">
          <span>Project Type / Primary Language</span>
          <span className="required-star" aria-hidden="true">*</span>
        </label>
        <span className="project-type-hint">Select starter template & runtime environment</span>
      </div>

      <div
        className="project-type-grid"
        role="radiogroup"
        aria-label="Project Type Selection"
      >
        {PROJECT_TYPES.map((type) => {
          const isSelected = selectedType === type.id;
          const { Icon } = type;

          return (
            <div
              key={type.id}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : 0}
              className={`project-type-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => {
                if (!disabled && onChange) {
                  onChange(type.id);
                }
              }}
              onKeyDown={(e) => {
                if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
                  e.preventDefault();
                  if (onChange) onChange(type.id);
                }
              }}
            >
              {/* Radio Indicator & Icon Row */}
              <div className="card-top-row">
                <div
                  className="card-icon-badge"
                  style={{
                    color: type.color,
                    borderColor: type.borderColor,
                    backgroundColor: type.bgTint
                  }}
                >
                  <Icon size={16} />
                </div>

                <div className="card-tag-wrapper">
                  <span
                    className="card-tag"
                    style={{
                      color: type.color,
                      backgroundColor: type.bgTint
                    }}
                  >
                    {type.tag}
                  </span>
                  <div className={`card-radio ${isSelected ? 'active' : ''}`}>
                    {isSelected && <Check size={11} className="radio-check" strokeWidth={3} />}
                  </div>
                </div>
              </div>

              {/* Title & Short Description */}
              <div className="card-info">
                <h4 className="card-title">{type.name}</h4>
                <p className="card-desc">{type.description}</p>
              </div>

              {/* Starter Files Footer */}
              <div className="card-footer-files">
                <span className="starter-label">Starter:</span>
                <span className="starter-value" title={type.starterSummary}>
                  {type.starterSummary}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
