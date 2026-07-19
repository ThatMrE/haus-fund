/* @ds-bundle: {"format":3,"namespace":"HausFundDesignSystem_a048b8","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"StatCard","sourcePath":"components/core/StatCard.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"73e792d56233","components/core/Badge.jsx":"921135862f3a","components/core/Button.jsx":"13779db29e5f","components/core/Card.jsx":"18821661ebfd","components/core/StatCard.jsx":"4c5745a4598c","components/core/Tag.jsx":"4094e4a4d337","components/forms/Input.jsx":"1e7b18ca01ed","components/forms/Select.jsx":"90b960518fbd","decks/deck-stage.js":"208980974db4","ui_kits/fund-portal/CompanyDetail.jsx":"170a567e399c","ui_kits/fund-portal/Dashboard.jsx":"1e9781ad0376","ui_kits/fund-portal/Data.jsx":"3c2aa3fc993d","ui_kits/fund-portal/DealFlow.jsx":"3dc65e76cf81","ui_kits/fund-portal/Icons.jsx":"6d51923ccb06","ui_kits/fund-portal/LocalComponents.jsx":"ff386c37b8fb","ui_kits/fund-portal/Portfolio.jsx":"88573a1f89fe","ui_kits/fund-portal/Sidebar.jsx":"d46f8b10dd4e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.HausFundDesignSystem_a048b8 = window.HausFundDesignSystem_a048b8 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
/**
 * Avatar — displays a person or company with initials fallback.
 */
function Avatar({
  name,
  src,
  size = 'md',
  variant = 'default',
  shape = 'circle'
}) {
  const sizes = {
    xs: {
      dim: 24,
      fontSize: '9px',
      fontWeight: 700
    },
    sm: {
      dim: 32,
      fontSize: '12px',
      fontWeight: 700
    },
    md: {
      dim: 40,
      fontSize: '14px',
      fontWeight: 700
    },
    lg: {
      dim: 56,
      fontSize: '18px',
      fontWeight: 700
    },
    xl: {
      dim: 72,
      fontSize: '24px',
      fontWeight: 800
    }
  };
  const variants = {
    default: {
      backgroundColor: 'var(--canvas-3)',
      color: 'var(--ink-2)'
    },
    forest: {
      backgroundColor: 'var(--forest-5)',
      color: 'var(--forest-2)'
    },
    bronze: {
      backgroundColor: 'var(--bronze-5)',
      color: 'var(--bronze-1)'
    },
    steel: {
      backgroundColor: 'var(--steel-5)',
      color: 'var(--steel-2)'
    },
    dark: {
      backgroundColor: 'var(--ink-1)',
      color: 'var(--canvas-0)'
    },
    forest_dark: {
      backgroundColor: 'var(--forest-2)',
      color: 'var(--canvas-0)'
    }
  };
  const initials = name ? name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';
  const {
    dim,
    fontSize,
    fontWeight
  } = sizes[size];
  const borderRadius = shape === 'circle' ? '50%' : shape === 'rounded' ? 'var(--radius-md)' : 'var(--radius-sm)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: dim,
      height: dim,
      borderRadius,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontSize,
      fontWeight,
      flexShrink: 0,
      overflow: 'hidden',
      ...variants[variant]
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name || '',
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
/**
 * Badge — compact status indicator for categories, stages, and states.
 */
function Badge({
  children,
  variant = 'default',
  size = 'md'
}) {
  const variants = {
    default: {
      backgroundColor: 'var(--canvas-2)',
      color: 'var(--ink-2)',
      border: '1px solid var(--border-1)'
    },
    primary: {
      backgroundColor: 'var(--ink-1)',
      color: 'var(--canvas-0)',
      border: '1px solid transparent'
    },
    forest: {
      backgroundColor: 'var(--forest-5)',
      color: 'var(--forest-2)',
      border: '1px solid var(--forest-5)'
    },
    bronze: {
      backgroundColor: 'var(--bronze-5)',
      color: 'var(--bronze-1)',
      border: '1px solid var(--bronze-5)'
    },
    steel: {
      backgroundColor: 'var(--steel-5)',
      color: 'var(--steel-2)',
      border: '1px solid var(--steel-5)'
    },
    positive: {
      backgroundColor: 'var(--positive-bg)',
      color: 'var(--positive)',
      border: '1px solid var(--positive-bg)'
    },
    warning: {
      backgroundColor: 'var(--warning-bg)',
      color: 'var(--warning)',
      border: '1px solid var(--warning-bg)'
    },
    negative: {
      backgroundColor: 'var(--negative-bg)',
      color: 'var(--negative)',
      border: '1px solid var(--negative-bg)'
    },
    info: {
      backgroundColor: 'var(--info-bg)',
      color: 'var(--info)',
      border: '1px solid var(--info-bg)'
    }
  };
  const sizes = {
    sm: {
      padding: '2px 6px',
      fontSize: '10px',
      borderRadius: 'var(--radius-xs)',
      height: '18px'
    },
    md: {
      padding: '3px 8px',
      fontSize: '11px',
      borderRadius: 'var(--radius-sm)',
      height: '22px'
    },
    lg: {
      padding: '4px 10px',
      fontSize: '12px',
      borderRadius: 'var(--radius-sm)',
      height: '26px'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      ...variants[variant],
      ...sizes[size]
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
/**
 * Button — primary interactive action element.
 * Supports 7 visual variants, 3 sizes, disabled state, and full-width mode.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  fullWidth = false,
  type = 'button',
  as: Tag = 'button'
}) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    letterSpacing: '0.01em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    border: 'none',
    outline: 'none',
    textDecoration: 'none',
    boxSizing: 'border-box',
    transition: 'background-color 120ms var(--ease-default), opacity 120ms, transform 80ms var(--ease-default), box-shadow 120ms var(--ease-default)',
    width: fullWidth ? '100%' : 'auto',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)'
  };
  const sizes = {
    sm: {
      padding: '0 12px',
      height: '32px',
      fontSize: '12px',
      borderRadius: 'var(--radius-sm)'
    },
    md: {
      padding: '0 18px',
      height: '40px',
      fontSize: '14px',
      borderRadius: 'var(--radius-md)'
    },
    lg: {
      padding: '0 24px',
      height: '48px',
      fontSize: '15px',
      borderRadius: 'var(--radius-md)'
    }
  };
  const variants = {
    primary: {
      backgroundColor: hovered ? 'var(--ink-2)' : 'var(--ink-1)',
      color: 'var(--canvas-0)'
    },
    secondary: {
      backgroundColor: hovered ? 'var(--canvas-3)' : 'var(--canvas-2)',
      color: 'var(--ink-1)'
    },
    ghost: {
      backgroundColor: hovered ? 'var(--canvas-2)' : 'transparent',
      color: 'var(--ink-2)'
    },
    outline: {
      backgroundColor: hovered ? 'var(--canvas-2)' : 'transparent',
      color: 'var(--ink-1)',
      border: '1.5px solid var(--border-2)'
    },
    forest: {
      backgroundColor: hovered ? 'var(--forest-3)' : 'var(--forest-2)',
      color: '#ffffff'
    },
    bronze: {
      backgroundColor: hovered ? 'var(--bronze-2)' : 'var(--bronze-3)',
      color: '#ffffff'
    },
    danger: {
      backgroundColor: hovered ? '#a02a2a' : 'var(--negative)',
      color: '#ffffff'
    }
  };
  return /*#__PURE__*/React.createElement(Tag, {
    type: Tag === 'button' ? type : undefined,
    style: {
      ...base,
      ...sizes[size],
      ...variants[variant]
    },
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => {
      setHovered(false);
      setPressed(false);
    },
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false)
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
/**
 * Card — general-purpose elevated surface container.
 */
function Card({
  children,
  padding = 'md',
  shadow = 'sm',
  radius = 'md',
  border = true,
  background,
  onClick,
  style
}) {
  const [hovered, setHovered] = React.useState(false);
  const isClickable = typeof onClick === 'function';
  const paddings = {
    none: '0',
    sm: '12px',
    md: '20px',
    lg: '28px',
    xl: '40px'
  };
  const shadows = {
    none: 'none',
    xs: 'var(--shadow-xs)',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)'
  };
  const radii = {
    none: '0',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-lg)',
    lg: 'var(--radius-xl)',
    xl: 'var(--radius-2xl)'
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => isClickable && setHovered(true),
    onMouseLeave: () => isClickable && setHovered(false),
    style: {
      backgroundColor: background || 'var(--canvas-0)',
      padding: paddings[padding],
      boxShadow: isClickable && hovered ? 'var(--shadow-md)' : shadows[shadow],
      borderRadius: radii[radius],
      border: border ? '1px solid var(--border-1)' : 'none',
      cursor: isClickable ? 'pointer' : 'default',
      transition: 'box-shadow 160ms var(--ease-default), transform 120ms var(--ease-default)',
      transform: isClickable && hovered ? 'translateY(-1px)' : 'translateY(0)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/StatCard.jsx
try { (() => {
/**
 * StatCard — key metric display with label, value, optional trend and subvalue.
 * Signature component for Haus Fund dashboards and LP reports.
 */
function StatCard({
  label,
  value,
  subvalue,
  trend,
  trendValue,
  accent = 'default'
}) {
  const accentColors = {
    default: 'var(--border-2)',
    forest: 'var(--forest-2)',
    bronze: 'var(--bronze-3)',
    steel: 'var(--steel-2)'
  };
  const trendColors = {
    up: 'var(--positive)',
    down: 'var(--negative)',
    flat: 'var(--ink-3)'
  };
  const trendArrows = {
    up: '↑',
    down: '↓',
    flat: '→'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: 'var(--canvas-0)',
      border: '1px solid var(--border-1)',
      borderTop: `3px solid ${accentColors[accent]}`,
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-3xl)',
      fontWeight: 700,
      lineHeight: 1.05,
      color: 'var(--ink-1)',
      letterSpacing: '-0.01em'
    }
  }, value), (subvalue || trend) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '2px'
    }
  }, subvalue && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      color: 'var(--ink-3)'
    }
  }, subvalue), trend && trendValue && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      fontWeight: 600,
      color: trendColors[trend]
    }
  }, trendArrows[trend], " ", trendValue)));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
/**
 * Tag — removable or static category chip for filtering and classification.
 */
function Tag({
  children,
  color = 'default',
  onRemove,
  onClick
}) {
  const [hovered, setHovered] = React.useState(false);
  const colors = {
    default: {
      backgroundColor: hovered ? 'var(--canvas-3)' : 'var(--canvas-2)',
      color: 'var(--ink-2)',
      borderColor: 'var(--border-2)'
    },
    forest: {
      backgroundColor: 'var(--forest-5)',
      color: 'var(--forest-2)',
      borderColor: 'rgba(28,59,45,0.2)'
    },
    bronze: {
      backgroundColor: 'var(--bronze-5)',
      color: 'var(--bronze-1)',
      borderColor: 'rgba(184,146,74,0.25)'
    },
    steel: {
      backgroundColor: 'var(--steel-5)',
      color: 'var(--steel-2)',
      borderColor: 'rgba(26,61,92,0.2)'
    },
    ink: {
      backgroundColor: 'var(--ink-1)',
      color: 'var(--canvas-0)',
      borderColor: 'var(--ink-1)'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid',
      fontFamily: 'var(--font-body)',
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.4,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background-color 120ms var(--ease-default)',
      ...colors[color]
    }
  }, children, onRemove && /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onRemove();
    },
    style: {
      background: 'none',
      border: 'none',
      padding: '0 1px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      color: 'inherit',
      opacity: 0.5,
      fontSize: '14px',
      lineHeight: 1,
      marginLeft: '1px'
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
/**
 * Input — single-line text field with label, hint, error, prefix/suffix support.
 */
function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  error,
  hint,
  disabled = false,
  size = 'md',
  prefix,
  suffix,
  required = false,
  id
}) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const sizes = {
    sm: {
      height: '32px',
      fontSize: '13px',
      px: '10px'
    },
    md: {
      height: '40px',
      fontSize: '14px',
      px: '12px'
    },
    lg: {
      height: '48px',
      fontSize: '15px',
      px: '14px'
    }
  };
  const sz = sizes[size];
  const borderColor = error ? 'var(--negative)' : focused ? 'var(--ink-3)' : 'var(--border-2)';
  const focusRing = focused && !error ? '0 0 0 3px var(--canvas-3)' : 'none';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      fontWeight: 600,
      color: 'var(--ink-2)',
      letterSpacing: '0.005em'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--negative)',
      marginLeft: '3px'
    }
  }, "*")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'stretch',
      height: sz.height,
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${borderColor}`,
      backgroundColor: disabled ? 'var(--canvas-2)' : 'var(--canvas-0)',
      boxShadow: focusRing,
      transition: 'border-color 140ms var(--ease-default), box-shadow 140ms var(--ease-default)',
      overflow: 'hidden'
    }
  }, prefix && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `0 ${sz.px}`,
      display: 'flex',
      alignItems: 'center',
      fontSize: sz.fontSize,
      fontFamily: 'var(--font-body)',
      color: 'var(--ink-3)',
      backgroundColor: 'var(--canvas-2)',
      borderRight: '1px solid var(--border-1)',
      flexShrink: 0,
      whiteSpace: 'nowrap'
    }
  }, prefix), /*#__PURE__*/React.createElement("input", {
    id: inputId,
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    required: required,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      flex: 1,
      height: '100%',
      border: 'none',
      outline: 'none',
      padding: `0 ${sz.px}`,
      fontSize: sz.fontSize,
      fontFamily: 'var(--font-body)',
      color: 'var(--ink-1)',
      backgroundColor: 'transparent',
      cursor: disabled ? 'not-allowed' : 'text'
    }
  }), suffix && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `0 ${sz.px}`,
      display: 'flex',
      alignItems: 'center',
      fontSize: sz.fontSize,
      fontFamily: 'var(--font-body)',
      color: 'var(--ink-3)',
      backgroundColor: 'var(--canvas-2)',
      borderLeft: '1px solid var(--border-1)',
      flexShrink: 0,
      whiteSpace: 'nowrap'
    }
  }, suffix)), (error || hint) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '12px',
      color: error ? 'var(--negative)' : 'var(--ink-3)',
      lineHeight: 1.4
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
/**
 * Select — single-choice dropdown with label, hint, and error support.
 */
function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  error,
  hint,
  disabled = false,
  size = 'md',
  required = false,
  id
}) {
  const [focused, setFocused] = React.useState(false);
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const sizes = {
    sm: {
      height: '32px',
      fontSize: '13px',
      px: '10px'
    },
    md: {
      height: '40px',
      fontSize: '14px',
      px: '12px'
    },
    lg: {
      height: '48px',
      fontSize: '15px',
      px: '14px'
    }
  };
  const sz = sizes[size];
  const borderColor = error ? 'var(--negative)' : focused ? 'var(--ink-3)' : 'var(--border-2)';
  const focusRing = focused && !error ? '0 0 0 3px var(--canvas-3)' : 'none';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: selectId,
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--negative)',
      marginLeft: '3px'
    }
  }, "*")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("select", {
    id: selectId,
    value: value,
    onChange: onChange,
    disabled: disabled,
    required: required,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      width: '100%',
      height: sz.height,
      padding: `0 36px 0 ${sz.px}`,
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focusRing,
      backgroundColor: disabled ? 'var(--canvas-2)' : 'var(--canvas-0)',
      color: value ? 'var(--ink-1)' : 'var(--ink-4)',
      fontSize: sz.fontSize,
      fontFamily: 'var(--font-body)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      appearance: 'none',
      outline: 'none',
      transition: 'border-color 140ms var(--ease-default), box-shadow 140ms var(--ease-default)'
    }
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options.map(opt => {
    const val = typeof opt === 'string' ? opt : opt.value;
    const lbl = typeof opt === 'string' ? opt : opt.label;
    return /*#__PURE__*/React.createElement("option", {
      key: val,
      value: val
    }, lbl);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      color: 'var(--ink-3)',
      fontSize: '11px'
    }
  }, "\u25BE")), (error || hint) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '12px',
      color: error ? 'var(--negative)' : 'var(--ink-3)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// decks/deck-stage.js
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
/* ═══ THIS PROJECT USES DESIGN COMPONENTS (.dc.html) ═══
 * Reference this stage from your <x-dc> template as an import — NEVER as a
 * raw <deck-stage> tag plus a <script src> (that hides the whole deck until
 * the stream finishes):
 *
 *   <x-import component-from-global-scope="deck-stage" from="./deck-stage.js"
 *             width="1920" height="1080" hint-size="100%,100%">
 *     <section data-label="Title" style="...">…</section>
 *     <section data-label="Agenda" style="...">…</section>
 *   </x-import>
 *
 * Slides are inline-styled <section> siblings; do not add a stylesheet or a
 * deck-stage:not(:defined) rule. The plain-HTML "Usage" block in the comment
 * below does NOT apply to .dc.html templates.
 */
/* BEGIN USAGE */
/**
 * <deck-stage> — reusable web component for HTML decks.
 *
 * Handles:
 *  (a) speaker notes — reads <script type="application/json" id="speaker-notes">
 *      and posts {slideIndexChanged: N} to the parent window on nav.
 *  (b) keyboard navigation — ←/→, PgUp/PgDn, Space, Home/End, number keys.
 *      On touch devices, tapping the left/right half of the stage goes
 *      prev/next — taps on links, buttons and other interactive slide
 *      content are left alone.
 *  (c) press R to reset to slide 0 (with a tasteful keyboard hint).
 *  (d) bottom-center overlay showing slide count + hints, fades out on idle.
 *  (e) auto-scaling — inner canvas is a fixed design size (default 1920×1080)
 *      scaled with `transform: scale()` to fit the viewport, letterboxed.
 *      Set the `noscale` attribute to render at authored size (1:1) — the
 *      PPTX exporter sets this so its DOM capture sees unscaled geometry.
 *  (f) print — `@media print` lays every slide out as its own page at the
 *      design size, so the browser's Print → Save as PDF produces a clean
 *      one-page-per-slide PDF with no extra setup.
 *  (g) thumbnail rail — resizable left-hand column of per-slide thumbnails
 *      (static clones). Click to navigate; ↑/↓ with a thumbnail focused to
 *      step between slides; drag to reorder; right-click for
 *      Skip / Move up / Move down / Duplicate / Delete (Delete opens a
 *      Cancel/Delete confirm dialog). Drag the rail's right edge to resize;
 *      width persists to
 *      localStorage. Skipped slides carry `data-deck-skip`, are dimmed in
 *      the rail, omitted from prev/next navigation, and hidden at print.
 *      The rail is suppressed in presenting mode, in the host's Preview
 *      mode (ViewerMode='none'), on `noscale`, on narrow viewports
 *      (≤640px), and via the `no-rail` attribute. Rail mutations dispatch
 *      a `dc-op` CustomEvent on the element (see docs/dc-ops.md) and do
 *      NOT touch the DOM: the host applies the op and re-renders;
 *      structural rail input is locked until the host posts
 *      {__dc_op_ack: true, applied}.
 *
 * Slides are HIDDEN, not unmounted. Non-active slides stay in the DOM with
 * `visibility: hidden` + `opacity: 0`, so their state (videos, iframes,
 * form inputs, React trees) is preserved across navigation.
 *
 * Lifecycle event — the component dispatches a `slidechange` CustomEvent on
 * itself whenever the active slide changes (including the initial mount).
 * The event bubbles and composes out of shadow DOM, so you can listen on
 * the <deck-stage> element or on document:
 *
 *   document.querySelector('deck-stage').addEventListener('slidechange', (e) => {
 *     e.detail.index         // new 0-based index
 *     e.detail.previousIndex // previous index, or -1 on init
 *     e.detail.total         // total slide count
 *     e.detail.slide         // the new active slide element
 *     e.detail.previousSlide // the prior slide element, or null on init
 *     e.detail.reason        // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
 *   });
 *
 * Persistence: none at the deck level. The host app keeps the current slide
 * in its own URL (?slide=) and re-delivers it via location.hash on load, so a
 * bare load with no hash always starts at slide 1.
 *
 * Usage:
 *   <style>deck-stage:not(:defined){visibility:hidden}</style>
 *   <deck-stage width="1920" height="1080">
 *     <section data-label="Title">...</section>
 *     <section data-label="Agenda">...</section>
 *   </deck-stage>
 *   <script src="deck-stage.js"></script>
 *
 * The :not(:defined) rule prevents a flash of the first slide at its
 * authored styles before this script runs and attaches the shadow root.
 *
 * Slides are the direct element children of <deck-stage>. Each slide is
 * automatically tagged with:
 *   - data-screen-label="NN Label"   (1-indexed, for comment flow)
 *   - data-om-validate="no_overflowing_text,no_overlapping_text,slide_sized_text"
 *
 * Speaker notes stay in sync because the component posts {slideIndexChanged: N}
 * to the parent — just include the #speaker-notes script tag if asked for notes.
 *
 * Authoring guidance:
 *   - Write slide bodies as static HTML inside <deck-stage>, with sizing via
 *     CSS custom properties in a <style> block rather than JS constants.
 *     Static slide markup is what lets the user click a heading in edit mode
 *     and retype it directly; a slide rendered through <script type="text/babel">,
 *     React, or a loop over a JS array has to round-trip every tweak through a
 *     chat message instead. Reach for script-generated slides only when the
 *     content genuinely needs interactive behaviour static HTML can't express.
 *   - Do NOT set position/inset/width/height on the slide <section> elements —
 *     the component absolutely positions every slotted child for you.
 *   - Entrance animations: make the visible end-state the base style and
 *     animate *from* hidden, so print and reduced-motion show content.
 *     Gate the animation on [data-deck-active] and the motion query, e.g.
 *     `@media (prefers-reduced-motion:no-preference){ [data-deck-active] .x{animation:fade-in .5s both} }`.
 *     Avoid infinite decorative loops on slide content.
 */
/* END USAGE */

(() => {
  const DESIGN_W_DEFAULT = 1920;
  const DESIGN_H_DEFAULT = 1080;
  const OVERLAY_HIDE_MS = 1800;
  const VALIDATE_ATTR = 'no_overflowing_text,no_overlapping_text,slide_sized_text';
  const FINE_POINTER_MQ = matchMedia('(hover: hover) and (pointer: fine)');
  const NARROW_MQ = matchMedia('(max-width: 640px)');
  // Slide-authored controls that should keep a tap instead of it navigating.
  const INTERACTIVE_SEL = 'a[href], button, input, select, textarea, summary, label, video[controls], audio[controls], [role="button"], [onclick], [tabindex]:not([tabindex^="-"]), [contenteditable]:not([contenteditable="false" i])';
  const pad2 = n => String(n).padStart(2, '0');

  // Label precedence: data-label → data-screen-label (number stripped) → first heading → "Slide".
  const getSlideLabel = el => {
    const explicit = el.getAttribute('data-label');
    if (explicit) return explicit;
    const existing = el.getAttribute('data-screen-label');
    if (existing) return existing.replace(/^\s*\d+\s*/, '').trim() || existing;
    const h = el.querySelector('h1, h2, h3, [data-title]');
    const t = h && (h.textContent || '').trim().slice(0, 40);
    if (t) return t;
    return 'Slide';
  };
  const stylesheet = `
    :host {
      position: fixed;
      inset: 0;
      display: block;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }
    /* connectedCallback holds this until document.fonts.ready (capped 2s) so
     * the first visible paint has the deck's real typography + final rail
     * layout. opacity (not visibility) so the active slide can't un-hide
     * itself via the ::slotted([data-deck-active]) visibility:visible rule.
     * Only the stage/rail hide — the black :host background stays, so the
     * iframe doesn't flash the page's default white. */
    :host([data-fonts-pending]) .stage,
    :host([data-fonts-pending]) .rail { opacity: 0; pointer-events: none; }

    .stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .canvas {
      position: relative;
      transform-origin: center center;
      flex-shrink: 0;
      background: #fff;
      will-change: transform;
    }

    /* Slides live in light DOM (via <slot>) so authored CSS still applies.
       We absolutely position each slotted child to stack them. */
    ::slotted(*) {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }
    ::slotted([data-deck-active]) {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
    }

    .overlay {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translate(-50%, 6px) scale(0.92);
      filter: blur(6px);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      background: #000;
      color: #fff;
      border-radius: 999px;
      font-size: 12px;
      font-feature-settings: "tnum" 1;
      letter-spacing: 0.01em;
      opacity: 0;
      pointer-events: none;
      transition: opacity 260ms ease, transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease;
      transform-origin: center bottom;
      z-index: 2147483000;
      user-select: none;
    }
    .overlay[data-visible] {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, 0) scale(1);
      filter: blur(0);
    }

    .btn {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      margin: 0;
      padding: 0;
      color: inherit;
      font: inherit;
      cursor: default;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      min-width: 28px;
      border-radius: 999px;
      color: rgba(255,255,255,0.72);
      transition: background 140ms ease, color 140ms ease;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .btn:active { background: rgba(255,255,255,0.18); }
    .btn:focus { outline: none; }
    .btn:focus-visible { outline: none; }
    .btn::-moz-focus-inner { border: 0; }
    .btn svg { width: 14px; height: 14px; display: block; }
    .btn.reset {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      padding: 0 10px 0 12px;
      gap: 6px;
      color: rgba(255,255,255,0.72);
    }
    .btn.reset .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 10px;
      line-height: 1;
      color: rgba(255,255,255,0.88);
      background: rgba(255,255,255,0.12);
      border-radius: 4px;
    }

    .count {
      font-variant-numeric: tabular-nums;
      color: #fff;
      font-weight: 500;
      padding: 0 8px;
      min-width: 42px;
      text-align: center;
      font-size: 12px;
    }
    .count .sep { color: rgba(255,255,255,0.45); margin: 0 3px; font-weight: 400; }
    .count .total { color: rgba(255,255,255,0.55); }

    .divider {
      width: 1px;
      height: 14px;
      background: rgba(255,255,255,0.18);
      margin: 0 2px;
    }

    /* ── Thumbnail rail ──────────────────────────────────────────────────
       Fixed column on the left; each thumbnail is a static deep-clone of
       the light-DOM slide scaled into a 16:9 (or design-aspect) frame. The
       stage re-fits around it (see _fit); hidden during present / noscale
       / print so capture geometry and fullscreen output are unchanged. */
    .rail {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: var(--deck-rail-w, 188px);
      background: #141414;
      border-right: 1px solid rgba(255,255,255,0.08);
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 10px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 2147482500;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.18) transparent;
    }
    .rail::-webkit-scrollbar { width: 8px; }
    .rail::-webkit-scrollbar-track { background: transparent; margin: 2px; }
    .rail::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.18);
      border-radius: 4px;
      border: 2px solid transparent;
      background-clip: content-box;
    }
    .rail::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.28);
      border: 2px solid transparent;
      background-clip: content-box;
    }
    :host([no-rail]) .rail,
    :host([noscale]) .rail { display: none; }
    .rail[data-presenting] { display: none; }
    @media (max-width: 640px) {
      .rail, .rail-resize { display: none; }
    }
    /* User-driven show/hide (the TweaksPanel toggle) slides instead of
       popping. Transitions are gated on :host([data-rail-anim]) — set only
       for the 200ms around the toggle — so window-resize and rail-width
       drag (which also call _fit) don't lag behind the cursor. */
    .rail[data-user-hidden] { transform: translateX(-100%); }
    :host([data-rail-anim]) .rail { transition: transform 200ms cubic-bezier(.3,.7,.4,1); }
    :host([data-rail-anim]) .stage { transition: left 200ms cubic-bezier(.3,.7,.4,1); }
    :host([data-rail-anim]) .canvas { transition: transform 200ms cubic-bezier(.3,.7,.4,1); }
    /* transition shorthand replaces rather than merges — repeat the base
       .overlay opacity/transform/filter transitions so visibility changes
       during the 200ms toggle window still fade instead of popping. */
    :host([data-rail-anim]) .overlay {
      transition: margin-left 200ms cubic-bezier(.3,.7,.4,1),
                  opacity 260ms ease,
                  transform 260ms cubic-bezier(.2,.8,.2,1),
                  filter 260ms ease;
    }

    .thumb {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }
    .thumb .num {
      width: 16px;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 500;
      text-align: right;
      color: rgba(255,255,255,0.55);
      padding-top: 2px;
      font-variant-numeric: tabular-nums;
    }
    .thumb .frame {
      position: relative;
      flex: 1;
      min-width: 0;
      aspect-ratio: var(--deck-aspect);
      background: #fff;
      border-radius: 4px;
      outline: 2px solid transparent;
      outline-offset: 0;
      overflow: hidden;
      transition: outline-color 120ms ease;
    }
    .thumb:hover .frame { outline-color: rgba(255,255,255,0.25); }
    .thumb { outline: none; }
    .thumb:focus-visible .frame { outline-color: rgba(255,255,255,0.5); }
    .thumb[data-current] .num { color: #fff; }
    .thumb[data-current] .frame { outline-color: #D97757; }
    .thumb[data-dragging] { opacity: 0.35; }
    .thumb::before {
      content: '';
      position: absolute;
      left: 24px;
      right: 0;
      height: 3px;
      border-radius: 2px;
      background: #D97757;
      opacity: 0;
      pointer-events: none;
    }
    .thumb[data-drop="before"]::before { top: -8px; opacity: 1; }
    .thumb[data-drop="after"]::before { bottom: -8px; opacity: 1; }
    .thumb[data-skip] .frame { opacity: 0.35; }
    .thumb[data-skip] .frame::after {
      content: 'Skipped';
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.45);
      color: #fff;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.04em;
    }

    .ctxmenu {
      position: fixed;
      min-width: 150px;
      padding: 4px;
      background: #242424;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 7px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      z-index: 2147483100;
      display: none;
      font-size: 12px;
    }
    .ctxmenu[data-open] { display: block; }
    .ctxmenu button {
      display: block;
      width: 100%;
      appearance: none;
      border: 0;
      background: transparent;
      color: #e8e8e8;
      font: inherit;
      text-align: left;
      padding: 6px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
    .ctxmenu button:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
    .ctxmenu button:disabled { opacity: 0.35; cursor: default; }
    .ctxmenu hr {
      border: 0;
      border-top: 1px solid rgba(255,255,255,0.1);
      margin: 4px 2px;
    }

    .rail-resize {
      position: fixed;
      left: calc(var(--deck-rail-w, 188px) - 3px);
      top: 0;
      bottom: 0;
      width: 6px;
      cursor: col-resize;
      z-index: 2147482600;
      touch-action: none;
    }
    .rail-resize:hover,
    .rail-resize[data-dragging] { background: rgba(255,255,255,0.12); }
    :host([no-rail]) .rail-resize,
    :host([noscale]) .rail-resize,
    .rail[data-presenting] + .rail-resize,
    .rail[data-user-hidden] + .rail-resize { display: none; }

    /* Delete-confirm popup — matches the SPA's ConfirmDialog layout
       (title + message body, depressed footer with Cancel / Delete). */
    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 2147483200;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .confirm-backdrop[data-open] { display: flex; }
    .confirm {
      width: 320px;
      max-width: calc(100vw - 32px);
      background: #2a2a2a;
      color: #e8e8e8;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      overflow: hidden;
      font-family: inherit;
      animation: deck-confirm-in 0.18s ease;
    }
    @keyframes deck-confirm-in {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .confirm .body { padding: 20px 20px 16px; }
    .confirm .title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .confirm .msg { font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.65); }
    .confirm .footer {
      padding: 14px 20px;
      background: #1f1f1f;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .confirm button {
      appearance: none;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
    }
    .confirm .cancel {
      background: transparent;
      border: 0;
      color: rgba(255,255,255,0.8);
    }
    .confirm .cancel:hover { background: rgba(255,255,255,0.08); }
    .confirm .danger {
      background: #c96442;
      border: 1px solid rgba(0,0,0,0.15);
      color: #fff;
      box-shadow: 0 1px 3px rgba(166,50,68,0.3), 0 2px 6px rgba(166,50,68,0.18);
    }
    .confirm .danger:hover { background: #b5563a; }

    /* ── Print: one page per slide, no chrome ────────────────────────────
       The screen layout stacks every slide at inset:0 inside a scaled
       canvas; for print we want them in document flow at the authored
       design size so the browser paginates one slide per sheet. The
       @page size is set from the width/height attributes via the inline
       <style id="deck-stage-print-page"> that _syncPrintPageRule appends
       to the document (the @page at-rule has no effect inside shadow DOM). */
    @media print {
      :host {
        position: static;
        inset: auto;
        background: none;
        overflow: visible;
        color: inherit;
      }
      .stage { position: static; display: block; }
      .canvas {
        transform: none !important;
        width: auto !important;
        height: auto !important;
        background: none;
        will-change: auto;
      }
      ::slotted(*) {
        position: relative !important;
        inset: auto !important;
        width: var(--deck-design-w) !important;
        height: var(--deck-design-h) !important;
        box-sizing: border-box !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto;
        break-after: page;
        page-break-after: always;
        break-inside: avoid;
        overflow: hidden;
      }
      /* :last-child alone isn't enough once data-deck-skip hides the
         trailing slide(s) — the last *visible* slide still carries
         break-after:page and prints a blank sheet. _markLastVisible()
         maintains data-deck-last-visible on the last non-skipped slide. */
      ::slotted(*:last-child),
      ::slotted([data-deck-last-visible]) {
        break-after: auto;
        page-break-after: auto;
      }
      ::slotted([data-deck-skip]) { display: none !important; }
      .overlay, .rail, .rail-resize, .ctxmenu, .confirm-backdrop { display: none !important; }
    }
  `;
  class DeckStage extends HTMLElement {
    static get observedAttributes() {
      return ['width', 'height', 'noscale', 'no-rail'];
    }
    constructor() {
      super();
      this._root = this.attachShadow({
        mode: 'open'
      });
      this._index = 0;
      this._slides = [];
      this._notes = [];
      this._hideTimer = null;
      this._mouseIdleTimer = null;
      this._menuIndex = -1;
      this._onKey = this._onKey.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onSlotChange = this._onSlotChange.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onTap = this._onTap.bind(this);
      this._onMessage = this._onMessage.bind(this);
      // Capture-phase close so a click anywhere dismisses the menu, but
      // ignore clicks that land inside the menu itself — otherwise the
      // capture handler runs before the menu's own (bubble) handler and
      // clears _menuIndex out from under it.
      this._onDocClick = e => {
        if (this._menu && e.composedPath && e.composedPath().includes(this._menu)) return;
        this._closeMenu();
      };
    }
    get designWidth() {
      return parseInt(this.getAttribute('width'), 10) || DESIGN_W_DEFAULT;
    }
    get designHeight() {
      return parseInt(this.getAttribute('height'), 10) || DESIGN_H_DEFAULT;
    }
    connectedCallback() {
      // Presenter-view popup loads deckUrl?_snthumb=...#N for its prev/cur/
      // next thumbnails — the rail has no business rendering inside those
      // (wrong scale, and it offsets the stage so the thumb shows a gutter).
      if (/[?&]_snthumb=/.test(location.search)) this.setAttribute('no-rail', '');
      this._render();
      this._loadNotes();
      this._syncPrintPageRule();
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('mousemove', this._onMouseMove, {
        passive: true
      });
      window.addEventListener('message', this._onMessage);
      window.addEventListener('click', this._onDocClick, true);
      this.addEventListener('click', this._onTap);
      // Print lays every slide out as its own page, so [data-deck-active]-
      // gated entrance styles need the attribute on every slide (not just
      // the current one) or their content prints at the hidden base style.
      // The transient freeze style lands BEFORE the attributes so any
      // attribute-keyed transition fires at 0s (changing transition-
      // duration after a transition has started doesn't affect it).
      this._onBeforePrint = () => {
        this._syncPrintPageRule();
        if (this._freezeStyle) this._freezeStyle.remove();
        this._freezeStyle = document.createElement('style');
        this._freezeStyle.textContent = '*,*::before,*::after{transition-duration:0s !important}';
        document.head.appendChild(this._freezeStyle);
        this._slides.forEach(s => s.setAttribute('data-deck-active', ''));
      };
      this._onAfterPrint = () => {
        this._applyIndex({
          showOverlay: false,
          broadcast: false
        });
        if (this._freezeStyle) {
          this._freezeStyle.remove();
          this._freezeStyle = null;
        }
      };
      window.addEventListener('beforeprint', this._onBeforePrint);
      window.addEventListener('afterprint', this._onAfterPrint);
      // Initial collection + layout happens via slotchange, which fires on mount.
      this._enableRail();
      // Hold the stage hidden until webfonts are ready so the first visible
      // paint has the deck's real typography — the :not(:defined) guard in
      // the page HTML only covers custom-element upgrade, not font load.
      // Capped so a 404'd font URL can't blank the deck indefinitely.
      this.setAttribute('data-fonts-pending', '');
      const reveal = () => this.removeAttribute('data-fonts-pending');
      // rAF first: fonts.ready is a pre-resolved promise until layout has
      // resolved the slotted text's font-family and pushed a FontFace into
      // 'loading'. Reading it here in connectedCallback (parse-time) would
      // settle the race in a microtask before any font fetch starts.
      requestAnimationFrame(() => {
        Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 2000))]).then(reveal, reveal);
      });
    }
    _enableRail() {
      // Idempotent — older host builds still post __omelette_rail_enabled.
      // no-rail guard keeps the observers/stylesheet walk off the cheap path
      // for presenter-popup thumbnail iframes (up to 9 per view).
      if (this._railEnabled || this.hasAttribute('no-rail')) return;
      this._railEnabled = true;
      // Per-viewer preference — restored alongside rail width. Default on;
      // only a stored '0' (from the TweaksPanel toggle) hides it.
      this._railVisible = true;
      try {
        if (localStorage.getItem('deck-stage.railVisible') === '0') this._railVisible = false;
      } catch (e) {}
      // Live thumbnail updates: watch the light-DOM slides for content
      // edits and re-clone just the affected thumb(s), debounced. Ignore
      // the data-deck-* / data-screen-label / data-om-validate attributes
      // this component itself writes so nav doesn't trigger spurious
      // refreshes — except data-deck-skip, which now arrives from the host
      // re-render and is what updates the rail badge, print bookkeeping,
      // and deckSkipped re-broadcast.
      const OWN_ATTRS = /^data-(deck-(?!skip$)|screen-label$|om-validate$)/;
      this._liveDirty = new Set();
      this._liveObserver = new MutationObserver(records => {
        for (const r of records) {
          if (r.type === 'attributes' && OWN_ATTRS.test(r.attributeName || '')) continue;
          let n = r.target;
          while (n && n.parentElement !== this) n = n.parentElement;
          // Skip/unskip is handled below without re-cloning (the badge sits
          // on the thumb wrapper, not the clone) — don't mark the slide
          // dirty for an attr change whose only visible effect is the badge.
          if (n && this._slideSet && this._slideSet.has(n) && !(r.type === 'attributes' && r.attributeName === 'data-deck-skip')) {
            this._liveDirty.add(n);
          }
          // Host-driven skip toggle: sync the rail badge + print + presenter
          // skipped-list the way _toggleSkip used to do locally.
          if (r.type === 'attributes' && r.attributeName === 'data-deck-skip' && n && this._slideSet && this._slideSet.has(n)) {
            const i = this._slides.indexOf(n);
            if (this._thumbs && this._thumbs[i]) {
              if (n.hasAttribute('data-deck-skip')) this._thumbs[i].thumb.setAttribute('data-skip', '');else this._thumbs[i].thumb.removeAttribute('data-skip');
            }
            this._markLastVisible();
            try {
              window.postMessage({
                slideIndexChanged: this._index,
                deckTotal: this._slides.length,
                deckSkipped: this._skippedIndices()
              }, '*');
            } catch (e) {}
          }
        }
        if (this._liveDirty.size && !this._liveTimer) {
          this._liveTimer = setTimeout(() => {
            this._liveTimer = null;
            this._liveDirty.forEach(s => this._refreshThumb(s));
            this._liveDirty.clear();
          }, 200);
        }
      });
      this._liveObserver.observe(this, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
      });
      // Lazy thumbnail materialization — clone the slide only when its
      // frame scrolls into (or near) the rail viewport. rootMargin gives
      // ~4 thumbs of pre-load so fast scrolling doesn't flash blanks.
      this._railObserver = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting && e.target.__deckThumb) {
            this._materialize(e.target.__deckThumb);
          }
        });
      }, {
        root: this._rail,
        rootMargin: '400px 0px'
      });
      // Tweaks typically change CSS vars / attrs OUTSIDE <deck-stage>
      // (on <html>, <body>, a wrapper div, or a <style> tag), which
      // _liveObserver can't see. Re-snapshot author CSS (constructable
      // sheet is shared by reference, so one replaceSync updates every
      // thumb shadow root) and re-sync each thumb host's attrs + custom
      // properties. In-slide DOM mutations are _liveObserver's job.
      // Debounced so slider drags don't thrash.
      this._onTweakChange = () => {
        clearTimeout(this._tweakTimer);
        this._tweakTimer = setTimeout(() => {
          this._snapshotAuthorCss();
          // One getComputedStyle for the whole batch — each
          // getPropertyValue read below reuses the same computed style
          // as long as nothing invalidates layout between thumbs.
          const cs = getComputedStyle(this);
          (this._thumbs || []).forEach(t => {
            if (t.host) this._syncThumbHostAttrs(t.host, cs);
          });
        }, 120);
      };
      window.addEventListener('tweakchange', this._onTweakChange);
      this._snapshotAuthorCss();
      // Build the rail now that it's enabled — slotchange already fired,
      // so _renderRail's early-return skipped the initial build.
      this._syncRailHidden();
      this._renderRail();
      this._fit();
    }

    /** Snapshot document stylesheets into a constructable sheet that each
     *  thumbnail's nested shadow root adopts — so author CSS styles the
     *  cloned slide content without touching this component's chrome.
     *  Cross-origin sheets throw on .cssRules — skip them. Re-callable:
     *  the existing constructable sheet is reused via replaceSync so every
     *  already-adopted shadow root picks up the fresh CSS without re-adopt. */
    _snapshotAuthorCss() {
      // :root in an adopted sheet inside a shadow root matches nothing
      // (only the document root qualifies), so author rules like
      // `:root[data-voice="modern"] .serif` never reach the clones.
      // Rewrite :root → :host and mirror <html>'s data-*/class/lang onto
      // each thumb host (see _syncThumbHostAttrs) so the same selectors
      // match inside the thumbnail's shadow tree.
      const authorCss = Array.from(document.styleSheets).map(sh => {
        try {
          return Array.from(sh.cssRules).map(r => r.cssText).join('\n');
        } catch (e) {
          return '';
        }
      }).join('\n')
      // The shadow host is featureless outside the functional :host(...)
      // form, so any compound on :root — [attr], .class, #id, :pseudo —
      // must become :host(<compound>) not :host<compound>. Same for the
      // html type selector (Tailwind class-strategy dark mode emits
      // html.dark; Pico uses html[data-theme]), which has nothing to
      // match inside the thumb's shadow tree.
      .replace(/:root((?:\[[^\]]*\]|[.#][-\w]+|:[-\w]+(?:\([^)]*\))?)+)/g, ':host($1)').replace(/:root\b/g, ':host').replace(/(^|[\s,>~+(}])html((?:\[[^\]]*\]|[.#][-\w]+|:[-\w]+(?:\([^)]*\))?)+)(?![-\w])/g, '$1:host($2)').replace(/(^|[\s,>~+(}])html(?![-\w])/g, '$1:host');
      // Every custom property the author references. _syncThumbHostAttrs
      // mirrors each one's *computed* value at <deck-stage> onto the
      // thumb host so the live value wins over the :host default above
      // regardless of which ancestor the tweak wrote to (<html>, <body>,
      // a wrapper div, or the deck-stage element itself all inherit
      // down to getComputedStyle(this)).
      this._authorVars = new Set(authorCss.match(/--[\w-]+/g) || []);
      try {
        if (!this._adoptedSheet) this._adoptedSheet = new CSSStyleSheet();
        this._adoptedSheet.replaceSync(authorCss);
      } catch (e) {
        this._adoptedSheet = null;
        this._authorCss = authorCss;
      }
    }
    _syncThumbHostAttrs(host, cs) {
      const de = document.documentElement;
      // setAttribute overwrites but can't delete — an attr removed from
      // <html> (toggleAttribute off, classList emptied) would linger on
      // the host and :host([data-*]) / :host(.foo) rules would keep
      // matching. Remove stale mirrored attrs first; iterate backward
      // because removeAttribute mutates the live NamedNodeMap.
      for (let i = host.attributes.length - 1; i >= 0; i--) {
        const n = host.attributes[i].name;
        if ((n.startsWith('data-') || n === 'class' || n === 'lang') && !de.hasAttribute(n)) {
          host.removeAttribute(n);
        }
      }
      for (const a of de.attributes) {
        if (a.name.startsWith('data-') || a.name === 'class' || a.name === 'lang') {
          host.setAttribute(a.name, a.value);
        }
      }
      // The :root→:host rewrite in _snapshotAuthorCss pins each custom
      // property to its stylesheet default on the thumb host, shadowing
      // the live value that would otherwise inherit. Tweaks can write the
      // live value on any ancestor — <html>, <body>, a wrapper div, the
      // deck-stage element — so read it as the *computed* value at
      // <deck-stage> (which sees the whole inheritance chain) rather than
      // trying to guess which element the author wrote to. Inline on the
      // host beats the :host{} rule. remove-stale covers vars dropped
      // from the stylesheet between snapshots.
      const vars = this._authorVars || new Set();
      for (let i = host.style.length - 1; i >= 0; i--) {
        const p = host.style[i];
        if (p.startsWith('--') && !vars.has(p)) host.style.removeProperty(p);
      }
      const live = cs || getComputedStyle(this);
      vars.forEach(p => {
        const v = live.getPropertyValue(p);
        if (v) host.style.setProperty(p, v.trim());else host.style.removeProperty(p);
      });
    }
    disconnectedCallback() {
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('message', this._onMessage);
      window.removeEventListener('click', this._onDocClick, true);
      window.removeEventListener('beforeprint', this._onBeforePrint);
      window.removeEventListener('afterprint', this._onAfterPrint);
      if (this._freezeStyle) {
        this._freezeStyle.remove();
        this._freezeStyle = null;
      }
      this.removeEventListener('click', this._onTap);
      if (this._hideTimer) clearTimeout(this._hideTimer);
      if (this._mouseIdleTimer) clearTimeout(this._mouseIdleTimer);
      if (this._liveTimer) clearTimeout(this._liveTimer);
      if (this._tweakTimer) clearTimeout(this._tweakTimer);
      if (this._railAnimTimer) clearTimeout(this._railAnimTimer);
      if (this._scaleRaf) cancelAnimationFrame(this._scaleRaf);
      if (this._liveObserver) this._liveObserver.disconnect();
      if (this._railObserver) this._railObserver.disconnect();
      if (this._onTweakChange) window.removeEventListener('tweakchange', this._onTweakChange);
    }
    attributeChangedCallback() {
      if (this._canvas) {
        this._canvas.style.width = this.designWidth + 'px';
        this._canvas.style.height = this.designHeight + 'px';
        this._canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
        this._canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
        if (this._rail) {
          this._rail.style.setProperty('--deck-aspect', this.designWidth + '/' + this.designHeight);
        }
        this._fit();
        this._scaleThumbs();
        this._syncPrintPageRule();
      }
    }
    _render() {
      const style = document.createElement('style');
      style.textContent = stylesheet;
      const stage = document.createElement('div');
      stage.className = 'stage';
      const canvas = document.createElement('div');
      canvas.className = 'canvas';
      canvas.style.width = this.designWidth + 'px';
      canvas.style.height = this.designHeight + 'px';
      canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
      canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
      const slot = document.createElement('slot');
      slot.addEventListener('slotchange', this._onSlotChange);
      canvas.appendChild(slot);
      stage.appendChild(canvas);

      // Overlay: compact, solid black, with clickable controls.
      const overlay = document.createElement('div');
      overlay.className = 'overlay export-hidden';
      overlay.setAttribute('role', 'toolbar');
      overlay.setAttribute('aria-label', 'Deck controls');
      overlay.setAttribute('data-omelette-chrome', '');
      overlay.innerHTML = `
        <button class="btn prev" type="button" aria-label="Previous slide" title="Previous (←)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>
        </button>
        <span class="count" aria-live="polite"><span class="current">1</span><span class="sep">/</span><span class="total">1</span></span>
        <button class="btn next" type="button" aria-label="Next slide" title="Next (→)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>
        </button>
        <span class="divider"></span>
        <button class="btn reset" type="button" aria-label="Reset to first slide" title="Reset (R)">Reset<span class="kbd">R</span></button>
      `;
      overlay.querySelector('.prev').addEventListener('click', () => this._advance(-1, 'click'));
      overlay.querySelector('.next').addEventListener('click', () => this._advance(1, 'click'));
      overlay.querySelector('.reset').addEventListener('click', () => this._go(0, 'click'));

      // Thumbnail rail + context menu. Thumbnails are populated in
      // _renderRail() after _collectSlides().
      const rail = document.createElement('div');
      rail.className = 'rail export-hidden';
      rail.setAttribute('data-omelette-chrome', '');
      // Edit mode hooks wheel to pan the canvas; this opts the rail's own
      // scrollview out so thumbnails stay scrollable while editing.
      rail.setAttribute('data-dc-wheel-passthru', '');
      rail.style.setProperty('--deck-aspect', this.designWidth + '/' + this.designHeight);
      // Edge auto-scroll while dragging a thumb near the rail's top/bottom
      // so off-screen drop targets are reachable. Native dragover fires
      // continuously while the pointer is stationary, so a per-event nudge
      // (ramped by edge proximity) is enough — no rAF loop needed.
      rail.addEventListener('dragover', e => {
        if (this._dragFrom == null) return;
        const r = rail.getBoundingClientRect();
        const EDGE = 40;
        const dt = e.clientY - r.top;
        const db = r.bottom - e.clientY;
        if (dt < EDGE) rail.scrollTop -= Math.ceil((EDGE - dt) / 3);else if (db < EDGE) rail.scrollTop += Math.ceil((EDGE - db) / 3);
      });
      const menu = document.createElement('div');
      menu.className = 'ctxmenu export-hidden';
      menu.setAttribute('data-omelette-chrome', '');
      menu.innerHTML = `
        <button type="button" data-act="skip">Skip slide</button>
        <button type="button" data-act="up">Move up</button>
        <button type="button" data-act="down">Move down</button>
        <button type="button" data-act="duplicate">Duplicate slide</button>
        <hr>
        <button type="button" data-act="delete">Delete slide</button>
      `;
      menu.addEventListener('click', e => {
        const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (!act) return;
        const i = this._menuIndex;
        this._closeMenu();
        if (act === 'skip') this._toggleSkip(i);else if (act === 'up') this._moveSlide(i, i - 1);else if (act === 'down') this._moveSlide(i, i + 1);else if (act === 'duplicate') this._duplicateSlide(i);else if (act === 'delete') this._openConfirm(i);
      });
      menu.addEventListener('contextmenu', e => e.preventDefault());

      // Rail resize handle — drag to set --deck-rail-w, persisted to
      // localStorage so the width survives reloads.
      const resize = document.createElement('div');
      resize.className = 'rail-resize export-hidden';
      resize.setAttribute('data-omelette-chrome', '');
      resize.addEventListener('pointerdown', e => {
        e.preventDefault();
        resize.setPointerCapture(e.pointerId);
        resize.setAttribute('data-dragging', '');
        const move = ev => this._setRailWidth(ev.clientX);
        const up = () => {
          resize.removeEventListener('pointermove', move);
          resize.removeEventListener('pointerup', up);
          resize.removeEventListener('pointercancel', up);
          resize.removeAttribute('data-dragging');
          try {
            localStorage.setItem('deck-stage.railWidth', String(this._railPx));
          } catch (err) {}
        };
        resize.addEventListener('pointermove', move);
        resize.addEventListener('pointerup', up);
        resize.addEventListener('pointercancel', up);
      });

      // Delete-confirm dialog — mirrors the SPA's ConfirmDialog layout.
      const confirm = document.createElement('div');
      confirm.className = 'confirm-backdrop export-hidden';
      confirm.setAttribute('data-omelette-chrome', '');
      confirm.innerHTML = `
        <div class="confirm" role="dialog" aria-modal="true">
          <div class="body">
            <div class="title">Delete slide?</div>
            <div class="msg">This slide will be removed from the deck.</div>
          </div>
          <div class="footer">
            <button type="button" class="cancel">Cancel</button>
            <button type="button" class="danger">Delete</button>
          </div>
        </div>
      `;
      confirm.addEventListener('click', e => {
        if (e.target === confirm) this._closeConfirm();
      });
      confirm.querySelector('.cancel').addEventListener('click', () => this._closeConfirm());
      confirm.querySelector('.danger').addEventListener('click', () => {
        const i = this._confirmIndex;
        this._closeConfirm();
        this._deleteSlide(i);
      });
      this._root.append(style, rail, resize, stage, overlay, menu, confirm);
      this._canvas = canvas;
      this._stage = stage;
      this._slot = slot;
      this._overlay = overlay;
      this._rail = rail;
      this._resize = resize;
      this._menu = menu;
      this._confirm = confirm;
      this._countEl = overlay.querySelector('.current');
      this._totalEl = overlay.querySelector('.total');

      // Restore persisted rail width.
      let rw = 188;
      try {
        const s = localStorage.getItem('deck-stage.railWidth');
        if (s) rw = parseInt(s, 10) || rw;
      } catch (err) {}
      this._setRailWidth(rw);
      this._syncRailHidden();
    }
    _setRailWidth(px) {
      const w = Math.max(120, Math.min(360, Math.round(px)));
      this._railPx = w;
      this.style.setProperty('--deck-rail-w', w + 'px');
      this._fit();
      // _scaleThumbs forces a sync layout (frame.offsetWidth) then writes
      // N transforms. During a resize drag this runs per-pointermove;
      // coalesce to one per frame.
      if (!this._scaleRaf) {
        this._scaleRaf = requestAnimationFrame(() => {
          this._scaleRaf = null;
          this._scaleThumbs();
        });
      }
    }

    /** @page must live in the document stylesheet — it's a no-op inside
     *  shadow DOM. (Re-)append so any author @page landing later in
     *  source order can't reintroduce a margin and push each slide onto
     *  two sheets; called again from beforeprint. */
    _syncPrintPageRule() {
      const id = 'deck-stage-print-page';
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
      }
      (document.body || document.head).appendChild(tag);
      tag.textContent = '@page { size: ' + this.designWidth + 'px ' + this.designHeight + 'px; margin: 0; } ' + '@media print { html, body { margin: 0 !important; padding: 0 !important; background: none !important; overflow: visible !important; height: auto !important; } ' + '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; } ' +
      // Jump authored animations/transitions to their end state so print
      // never captures mid-entrance — pairs with the beforeprint handler
      // in connectedCallback that sets data-deck-active on every slide.
      '*, *::before, *::after { animation-delay: -99s !important; animation-duration: .001s !important; ' + 'animation-iteration-count: 1 !important; animation-fill-mode: both !important; ' + 'animation-play-state: running !important; transition-duration: 0s !important; } }';
    }
    _onSlotChange() {
      // Self-mutate path already reconciled synchronously and emitted
      // slidechange; skip the async slotchange it caused.
      if (this._squelchSlotChange) {
        this._squelchSlotChange = false;
        return;
      }
      // Primary lock-clear is the host's __deck_rail_ack; this clears on a
      // dropped ack so the rail can't stay dead.
      this._railLock = false;
      this._collectSlides();
      this._restoreIndex();
      this._applyIndex({
        showOverlay: false,
        broadcast: true,
        reason: 'init'
      });
      this._fit();
    }
    _collectSlides() {
      const assigned = this._slot.assignedElements({
        flatten: true
      });
      this._slides = assigned.filter(el => {
        // Skip template/style/script nodes even if someone slots them.
        const tag = el.tagName;
        return tag !== 'TEMPLATE' && tag !== 'SCRIPT' && tag !== 'STYLE';
      });
      this._slideSet = new Set(this._slides);
      this._slides.forEach((slide, i) => {
        const n = i + 1;
        slide.setAttribute('data-screen-label', `${pad2(n)} ${getSlideLabel(slide)}`);

        // Validation attribute for comment flow / auto-checks.
        if (!slide.hasAttribute('data-om-validate')) {
          slide.setAttribute('data-om-validate', VALIDATE_ATTR);
        }
        slide.setAttribute('data-deck-slide', String(i));
      });
      if (this._totalEl) this._totalEl.textContent = String(this._slides.length || 1);
      if (this._index >= this._slides.length) this._index = Math.max(0, this._slides.length - 1);
      this._markLastVisible();
      this._renderRail();
    }

    /** Tag the last non-skipped slide so print CSS can drop its
     *  break-after (see the @media print comment above — :last-child
     *  alone matches a hidden skipped slide). */
    _markLastVisible() {
      let last = null;
      this._slides.forEach(s => {
        s.removeAttribute('data-deck-last-visible');
        if (!s.hasAttribute('data-deck-skip')) last = s;
      });
      if (last) last.setAttribute('data-deck-last-visible', '');
    }
    _loadNotes() {
      // Per-slide data-speaker-notes is authoritative when present (attrs
      // travel with the element on reorder/dup/delete); a slide without
      // the attr falls through to the legacy #speaker-notes JSON array
      // PER SLIDE so a single attr on a JSON-authored deck doesn't blank
      // the rest.
      const tag = document.getElementById('speaker-notes');
      let json = null;
      if (tag) try {
        const p = JSON.parse(tag.textContent || '[]');
        if (Array.isArray(p)) json = p;
      } catch (e) {
        console.warn('[deck-stage] Failed to parse #speaker-notes JSON:', e);
      }
      this._notes = this._slides.map((s, i) => {
        const a = s.getAttribute('data-speaker-notes');
        return a !== null ? a : json && typeof json[i] === 'string' ? json[i] : '';
      });
    }
    _restoreIndex() {
      // The host's ?slide= param is delivered as a #<int> hash (1-indexed) on
      // the iframe src. No hash → slide 1; the deck itself keeps no position
      // state across loads.
      const h = (location.hash || '').match(/^#(\d+)$/);
      if (h) {
        const n = parseInt(h[1], 10) - 1;
        if (n >= 0 && n < this._slides.length) this._index = n;
      }
    }
    _applyIndex({
      showOverlay = true,
      broadcast = true,
      reason = 'init'
    } = {}) {
      if (!this._slides.length) return;
      const prev = this._prevIndex == null ? -1 : this._prevIndex;
      const curr = this._index;
      // Keep the iframe's own hash in sync so an in-iframe location.reload()
      // (reload banner path in viewer-handle.ts) lands on the current slide,
      // not the stale deep-link hash from initial load.
      try {
        history.replaceState(null, '', '#' + (curr + 1));
      } catch (e) {}
      this._slides.forEach((s, i) => {
        if (i === curr) s.setAttribute('data-deck-active', '');else s.removeAttribute('data-deck-active');
      });
      if (this._countEl) this._countEl.textContent = String(curr + 1);
      // Follow-scroll on every navigation (init deep-link, keyboard, click,
      // tap, external goTo) — the only time we *don't* want the rail to
      // track current is after a rail-internal mutation, where _renderRail
      // has already restored the user's scroll position and yanking back to
      // current would undo it.
      this._syncRail(reason !== 'mutation');
      if (broadcast) {
        // (1) Legacy: host-window postMessage for speaker-notes renderers.
        try {
          window.postMessage({
            slideIndexChanged: curr,
            deckTotal: this._slides.length,
            deckSkipped: this._skippedIndices()
          }, '*');
        } catch (e) {}

        // (2) In-page CustomEvent on the <deck-stage> element itself.
        //     Bubbles and composes out of shadow DOM so slide code can listen:
        //       document.querySelector('deck-stage').addEventListener('slidechange', e => {
        //         e.detail.index, e.detail.previousIndex, e.detail.total, e.detail.slide, e.detail.reason
        //       });
        const detail = {
          index: curr,
          previousIndex: prev,
          total: this._slides.length,
          slide: this._slides[curr] || null,
          previousSlide: prev >= 0 ? this._slides[prev] || null : null,
          reason: reason // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
        };
        this.dispatchEvent(new CustomEvent('slidechange', {
          detail,
          bubbles: true,
          composed: true
        }));
      }
      this._prevIndex = curr;
      if (showOverlay) this._flashOverlay();
    }
    _flashOverlay() {
      // Host posts __omelette_presenting while in fullscreen/tab presentation
      // mode — suppress the nav footer entirely (both hover and slide-change
      // flash) so the audience sees clean slides.
      if (!this._overlay || this._presenting) return;
      this._overlay.setAttribute('data-visible', '');
      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        this._overlay.removeAttribute('data-visible');
      }, OVERLAY_HIDE_MS);
    }
    _railWidth() {
      // State-based, no offsetWidth: the first _fit() can run before the
      // rail has had layout on some load paths, and a 0 there paints the
      // slide full-width for one frame before the post-slotchange _fit()
      // corrects it.
      if (!this._railEnabled || !this._railVisible || this.hasAttribute('no-rail') || this.hasAttribute('noscale') || this._presenting || this._previewMode || NARROW_MQ.matches) return 0;
      return this._railPx || 0;
    }
    _fit() {
      if (!this._canvas) return;
      const stage = this._canvas.parentElement;
      // PPTX export sets noscale so the DOM capture sees authored-size
      // geometry — the scaled canvas is in shadow DOM, so the exporter's
      // resetTransformSelector can't reach .canvas.style.transform directly.
      if (this.hasAttribute('noscale')) {
        this._canvas.style.transform = 'none';
        if (stage) stage.style.left = '0';
        if (this._overlay) this._overlay.style.marginLeft = '0';
        return;
      }
      const rw = this._railWidth();
      if (stage) stage.style.left = rw + 'px';
      // Overlay is centred on the viewport via left:50% + translate(-50%);
      // marginLeft shifts the centre by rw/2 so it lands in the middle of
      // the [rw, innerWidth] stage region.
      if (this._overlay) this._overlay.style.marginLeft = rw / 2 + 'px';
      const vw = window.innerWidth - rw;
      const vh = window.innerHeight;
      const s = Math.min(vw / this.designWidth, vh / this.designHeight);
      this._canvas.style.transform = `scale(${s})`;
    }
    _onResize() {
      this._fit();
      // Crossing the narrow-viewport breakpoint reveals the rail — rerun the
      // thumbnail scale the same way _setRailWidth does.
      if (!this._scaleRaf) {
        this._scaleRaf = requestAnimationFrame(() => {
          this._scaleRaf = null;
          this._scaleThumbs();
        });
      }
    }
    _onMouseMove() {
      // Keep overlay visible while mouse moves; hide after idle.
      this._flashOverlay();
    }
    _onMessage(e) {
      const d = e.data;
      if (d && typeof d.__omelette_presenting === 'boolean') {
        this._presenting = d.__omelette_presenting;
        if (this._presenting && this._overlay) {
          this._overlay.removeAttribute('data-visible');
          if (this._hideTimer) clearTimeout(this._hideTimer);
        }
        this._syncRailHidden();
        this._closeMenu();
        this._closeConfirm();
        this._fit();
        this._scaleThumbs();
      }
      // Host's Preview segment (ViewerMode='none'): the rail's drag-reorder /
      // right-click skip-delete affordances are editing chrome, so hide it
      // while the user is just looking at the deck. Same hard-hide path as
      // presenting; independent of the user's _railVisible preference so
      // returning to Edit restores whatever they had.
      if (d && typeof d.__omelette_preview_mode === 'boolean') {
        if (d.__omelette_preview_mode === this._previewMode) return;
        this._previewMode = d.__omelette_preview_mode;
        this._syncRailHidden();
        this._closeMenu();
        this._closeConfirm();
        this._fit();
        this._scaleThumbs();
      }
      // Host has processed a dc-op; rail input is safe again. Not tied to
      // slotchange — setAttr and refusal don't fire one. On refusal,
      // revert the optimistic _index/hash adjustment so the next nav
      // starts from what's actually on screen.
      if (d && d.__dc_op_ack) {
        this._railLock = false;
        if (d.applied === false && this._indexBeforeEmit != null) {
          this._index = this._indexBeforeEmit;
          try {
            history.replaceState(null, '', '#' + (this._index + 1));
          } catch (e) {}
        }
        this._indexBeforeEmit = null;
      }
      // Per-viewer show/hide, driven by the TweaksPanel's auto-injected
      // "Thumbnail rail" toggle (or any author script). Independent of
      // whether the Tweaks panel itself is open — closing the panel
      // doesn't change rail visibility. Persists alongside rail width.
      if (d && d.type === '__deck_rail_visible' && typeof d.on === 'boolean') {
        if (d.on === this._railVisible) return;
        this._railVisible = d.on;
        try {
          localStorage.setItem('deck-stage.railVisible', d.on ? '1' : '0');
        } catch (e) {}
        // Arm the transition, commit it, then flip state — otherwise the
        // browser coalesces both writes and nothing animates on show.
        this.setAttribute('data-rail-anim', '');
        void (this._rail && this._rail.offsetHeight);
        this._syncRailHidden();
        this._fit();
        this._scaleThumbs();
        clearTimeout(this._railAnimTimer);
        this._railAnimTimer = setTimeout(() => this.removeAttribute('data-rail-anim'), 220);
      }
      if (d && d.type === '__omelette_rail_enabled') this._enableRail();
    }
    _syncRailHidden() {
      if (!this._rail) return;
      // data-presenting is the hard hide (display:none) for flag-off,
      // presentation mode, and the host's Preview segment — instant, no
      // transition. data-user-hidden is the soft hide (translateX(-100%))
      // for the viewer's rail toggle, so show/hide slides under
      // :host([data-rail-anim]).
      const hard = !this._railEnabled || this._presenting || this._previewMode;
      if (hard) this._rail.setAttribute('data-presenting', '');else this._rail.removeAttribute('data-presenting');
      if (!this._railVisible) this._rail.setAttribute('data-user-hidden', '');else this._rail.removeAttribute('data-user-hidden');
      // translateX hide leaves thumbs (tabIndex=0) in the tab order —
      // inert keeps them unfocusable while the rail is off-screen.
      this._rail.inert = hard || !this._railVisible;
    }
    _onTap(e) {
      // Touch-only — keyboard + the overlay toolbar cover nav on desktop.
      if (FINE_POINTER_MQ.matches) return;
      // Only taps that land on the stage (slide content or letterbox); the
      // overlay / rail / menus are siblings with their own click handlers.
      const path = e.composedPath();
      if (!this._stage || !path.includes(this._stage)) return;
      // Let interactive slide content keep the tap. composedPath (not
      // e.target.closest) so we see through open shadow roots — a <button>
      // inside a slide-authored custom element retargets e.target to the
      // host but still appears in the composed path.
      if (e.defaultPrevented) return;
      for (const n of path) {
        if (n === this._stage) break;
        if (n.matches && n.matches(INTERACTIVE_SEL)) return;
      }
      e.preventDefault();
      const rw = this._railWidth();
      const mid = rw + (window.innerWidth - rw) / 2;
      this._advance(e.clientX < mid ? -1 : 1, 'tap');
    }
    _onKey(e) {
      // Ignore when the user is typing.
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // Confirm dialog swallows nav keys while open; Escape cancels. Enter
      // is left to the focused button's native activation so Tab→Cancel
      // →Enter activates Cancel, not the window-level confirm path.
      if (this._confirm && this._confirm.hasAttribute('data-open')) {
        if (e.key === 'Escape') {
          this._closeConfirm();
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Escape' && this._menu && this._menu.hasAttribute('data-open')) {
        this._closeMenu();
        e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      let handled = true;
      if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Spacebar') {
        this._advance(1, 'keyboard');
      } else if (key === 'ArrowLeft' || key === 'PageUp') {
        this._advance(-1, 'keyboard');
      } else if (key === 'Home') {
        this._go(0, 'keyboard');
      } else if (key === 'End') {
        this._go(this._slides.length - 1, 'keyboard');
      } else if (key === 'r' || key === 'R') {
        this._go(0, 'keyboard');
      } else if (/^[0-9]$/.test(key)) {
        // 1..9 jump to that slide; 0 jumps to 10.
        const n = key === '0' ? 9 : parseInt(key, 10) - 1;
        if (n < this._slides.length) this._go(n, 'keyboard');
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        this._flashOverlay();
      }
    }
    _go(i, reason = 'api') {
      if (!this._slides.length) return;
      const clamped = Math.max(0, Math.min(this._slides.length - 1, i));
      if (clamped === this._index) {
        this._flashOverlay();
        return;
      }
      this._index = clamped;
      this._applyIndex({
        showOverlay: true,
        broadcast: true,
        reason
      });
    }

    /** Step forward/back skipping any slide marked data-deck-skip. Falls
     *  back to _go's clamp-at-ends behaviour (flash overlay) when there's
     *  nothing further in that direction. */
    _advance(dir, reason) {
      if (!this._slides.length) return;
      let i = this._index + dir;
      while (i >= 0 && i < this._slides.length && this._slides[i].hasAttribute('data-deck-skip')) {
        i += dir;
      }
      if (i < 0 || i >= this._slides.length) {
        this._flashOverlay();
        return;
      }
      this._go(i, reason);
    }

    // ── Thumbnail rail ────────────────────────────────────────────────────
    //
    // Thumbs are keyed by slide element and reused across _renderRail()
    // calls, so a reorder/delete is an O(changed) DOM shuffle instead of an
    // O(N) teardown-and-re-clone. Each thumb starts as a lightweight shell
    // (num + empty frame); the clone is materialized lazily by an
    // IntersectionObserver when the frame scrolls into (or near) view, so
    // only visible-ish slides pay the clone + image-decode cost.

    _renderRail() {
      if (!this._rail || !this._railEnabled) {
        this._thumbs = [];
        return;
      }
      // FLIP: record each *materialized* thumb's top before the reconcile.
      // Off-screen (non-materialized) thumbs don't need the animation and
      // skipping their getBoundingClientRect saves a forced layout per
      // off-screen thumb on large decks.
      const prevTops = new Map();
      (this._thumbs || []).forEach(({
        thumb,
        slide,
        host
      }) => {
        if (host) prevTops.set(slide, thumb.getBoundingClientRect().top);
      });
      const st = this._rail.scrollTop;

      // Reconcile: reuse thumbs that already exist for a slide, create
      // shells for new slides, drop thumbs for removed slides.
      const bySlide = new Map();
      (this._thumbs || []).forEach(t => bySlide.set(t.slide, t));
      const next = [];
      this._slides.forEach(slide => {
        let t = bySlide.get(slide);
        if (t) bySlide.delete(slide);else t = this._makeThumb(slide);
        next.push(t);
      });
      // Orphans — slides removed since last render.
      bySlide.forEach(t => {
        if (this._railObserver) this._railObserver.unobserve(t.frame);
        t.thumb.remove();
      });
      // Put thumbs into document order to match _slides. insertBefore on
      // an already-correctly-placed node is a no-op, so this is cheap
      // when nothing moved.
      next.forEach((t, i) => {
        const want = t.thumb;
        const at = this._rail.children[i];
        if (at !== want) this._rail.insertBefore(want, at || null);
        t.i = i;
        t.num.textContent = String(i + 1);
        if (t.slide.hasAttribute('data-deck-skip')) t.thumb.setAttribute('data-skip', '');else t.thumb.removeAttribute('data-skip');
      });
      this._thumbs = next;
      this._rail.scrollTop = st;
      if (prevTops.size) {
        const moved = [];
        this._thumbs.forEach(({
          thumb,
          slide
        }) => {
          const old = prevTops.get(slide);
          if (old == null) return;
          const dy = old - thumb.getBoundingClientRect().top;
          if (Math.abs(dy) < 1) return;
          thumb.style.transition = 'none';
          thumb.style.transform = `translateY(${dy}px)`;
          moved.push(thumb);
        });
        if (moved.length) {
          // Commit the inverted positions before flipping the transition
          // on — otherwise the browser coalesces both style writes and
          // nothing animates.
          void this._rail.offsetHeight;
          moved.forEach(t => {
            t.style.transition = 'transform 180ms cubic-bezier(.2,.7,.3,1)';
            t.style.transform = '';
          });
          setTimeout(() => moved.forEach(t => {
            t.style.transition = '';
          }), 220);
        }
      }
      requestAnimationFrame(() => this._scaleThumbs());
      this._syncRail(false);
    }

    /** Create a lightweight thumb shell for one slide. The clone is
     *  materialized later by the IntersectionObserver. Event handlers
     *  look up the thumb's *current* index (via _thumbs.indexOf) so the
     *  same element can be reused across reorders. */
    _makeThumb(slide) {
      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.tabIndex = 0;
      const num = document.createElement('div');
      num.className = 'num';
      const frame = document.createElement('div');
      frame.className = 'frame';
      thumb.append(num, frame);
      const entry = {
        thumb,
        num,
        frame,
        slide,
        clone: null,
        host: null,
        i: -1
      };
      // entry.i is refreshed on every _renderRail reconcile pass, so
      // handlers read the thumb's current position without an O(N) scan.
      const idx = () => entry.i;
      thumb.addEventListener('click', () => this._go(idx(), 'click'));
      // ↑/↓ step through the rail when a thumb has focus. _go clamps at the
      // ends and _applyIndex→_syncRail scrolls the new current thumb into
      // view; we move focus to it (preventScroll — _syncRail already
      // scrolled) so a held key walks the whole list. stopPropagation keeps
      // this out of the window-level _onKey nav handler.
      thumb.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        this._go(idx() + (e.key === 'ArrowDown' ? 1 : -1), 'keyboard');
        const cur = this._thumbs && this._thumbs[this._index];
        if (cur) cur.thumb.focus({
          preventScroll: true
        });
      });
      thumb.addEventListener('contextmenu', e => {
        e.preventDefault();
        this._openMenu(idx(), e.clientX, e.clientY);
      });
      thumb.draggable = true;
      thumb.addEventListener('dragstart', e => {
        this._dragFrom = idx();
        thumb.setAttribute('data-dragging', '');
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', String(this._dragFrom));
        } catch (err) {}
      });
      thumb.addEventListener('dragend', () => {
        thumb.removeAttribute('data-dragging');
        this._clearDrop();
        this._dragFrom = null;
      });
      thumb.addEventListener('dragover', e => {
        if (this._dragFrom == null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const r = thumb.getBoundingClientRect();
        this._setDrop(idx(), e.clientY < r.top + r.height / 2 ? 'before' : 'after');
      });
      thumb.addEventListener('drop', e => {
        if (this._dragFrom == null) return;
        e.preventDefault();
        const i = idx();
        const r = thumb.getBoundingClientRect();
        let to = e.clientY >= r.top + r.height / 2 ? i + 1 : i;
        if (this._dragFrom < to) to--;
        const from = this._dragFrom;
        this._clearDrop();
        this._dragFrom = null;
        if (to !== from) this._moveSlide(from, to);
      });
      if (this._railObserver) this._railObserver.observe(frame);
      frame.__deckThumb = entry;
      return entry;
    }

    /** Lazily build the clone for a thumb that has scrolled into view. */
    _materialize(entry) {
      if (entry.host) return;
      const dw = this.designWidth,
        dh = this.designHeight;
      let clone = entry.slide.cloneNode(true);
      clone.removeAttribute('id');
      clone.removeAttribute('data-deck-active');
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      // Neuter heavy media; replace <video> with its poster so the box
      // keeps a visual. <iframe>/<audio> become empty placeholders.
      clone.querySelectorAll('iframe, audio, object, embed').forEach(el => {
        el.removeAttribute('src');
        el.removeAttribute('srcdoc');
        el.removeAttribute('data');
        el.innerHTML = '';
      });
      clone.querySelectorAll('video').forEach(el => {
        if (!el.poster) {
          el.removeAttribute('src');
          el.innerHTML = '';
          return;
        }
        const img = document.createElement('img');
        img.src = el.poster;
        img.alt = '';
        img.style.cssText = el.style.cssText + ';object-fit:cover;width:100%;height:100%;';
        img.className = el.className;
        el.replaceWith(img);
      });
      // Images: defer decode and let the browser pick the smallest
      // srcset candidate for the ~140px thumb. Same-URL clones reuse the
      // slide's decoded bitmap (URL-keyed cache), so the remaining cost
      // is paint/composite — lazy+async keeps that off the main thread.
      clone.querySelectorAll('img').forEach(el => {
        el.loading = 'lazy';
        el.decoding = 'async';
        if (el.srcset) el.sizes = (this._railPx || 188) + 'px';
      });
      // Custom elements inside the slide would have their
      // connectedCallback fire when the clone is appended. Replace them
      // with inert boxes so a component-heavy deck doesn't run N copies
      // of each component's mount logic in the rail. Children are
      // preserved so layout-wrapper elements (<my-column><h2>…</h2>)
      // still show their authored content; the querySelectorAll NodeList
      // is static, so nested custom elements in the moved subtree are
      // still visited on later iterations.
      const neuter = el => {
        const box = document.createElement('div');
        box.style.cssText = (el.getAttribute('style') || '') + ';background:rgba(0,0,0,0.06);border:1px dashed rgba(0,0,0,0.15);';
        box.className = el.className;
        // Preserve theming/i18n hooks so [data-*] / :lang() / [dir]
        // descendant selectors still match the neutered root.
        for (const a of el.attributes) {
          const n = a.name;
          if (n.startsWith('data-') || n.startsWith('aria-') || n === 'lang' || n === 'dir' || n === 'role' || n === 'title') {
            box.setAttribute(n, a.value);
          }
        }
        while (el.firstChild) box.appendChild(el.firstChild);
        return box;
      };
      // querySelectorAll('*') returns descendants only — a custom-element
      // slide root (<my-slide>…</my-slide>) would slip through and upgrade
      // on append. Swap the root first.
      if (clone.tagName.includes('-')) clone = neuter(clone);
      clone.querySelectorAll('*').forEach(el => {
        if (el.tagName.includes('-')) el.replaceWith(neuter(el));
      });
      clone.style.cssText += ';position:absolute;top:0;left:0;transform-origin:0 0;' + 'pointer-events:none;width:' + dw + 'px;height:' + dh + 'px;' + 'box-sizing:border-box;overflow:hidden;visibility:visible;opacity:1;';
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;inset:0;';
      this._syncThumbHostAttrs(host);
      const sr = host.attachShadow({
        mode: 'open'
      });
      if (this._adoptedSheet) sr.adoptedStyleSheets = [this._adoptedSheet];else {
        const st = document.createElement('style');
        st.textContent = this._authorCss || '';
        sr.appendChild(st);
      }
      sr.appendChild(clone);
      entry.frame.appendChild(host);
      entry.host = host;
      entry.clone = clone;
      if (this._thumbScale) clone.style.transform = 'scale(' + this._thumbScale + ')';
      // Once materialized the IO callback is a no-op early-return —
      // unobserve so scroll doesn't keep firing it.
      if (this._railObserver) this._railObserver.unobserve(entry.frame);
    }

    /** Re-clone a single thumb (live-update path). No-op if the thumb
     *  hasn't been materialized yet — it'll pick up current content when
     *  it scrolls into view. */
    _refreshThumb(slide) {
      const entry = (this._thumbs || []).find(t => t.slide === slide);
      if (!entry || !entry.host) return;
      entry.host.remove();
      entry.host = entry.clone = null;
      this._materialize(entry);
    }
    _scaleThumbs() {
      if (!this._thumbs || !this._thumbs.length) return;
      // Every frame is the same width; if it reads 0 the rail is
      // display:none (noscale / no-rail / presenting / print) — leave the
      // clones as-is and re-run when the rail is revealed.
      const fw = this._thumbs[0].frame.offsetWidth;
      if (!fw) return;
      this._thumbScale = fw / this.designWidth;
      this._thumbs.forEach(({
        clone
      }) => {
        if (clone) clone.style.transform = 'scale(' + this._thumbScale + ')';
      });
    }
    _setDrop(i, where) {
      // dragover fires at pointer-event rate; touch only the previous
      // and new target rather than sweeping all N thumbs.
      const t = this._thumbs && this._thumbs[i];
      if (this._dropOn && this._dropOn !== t) {
        this._dropOn.thumb.removeAttribute('data-drop');
      }
      if (t) t.thumb.setAttribute('data-drop', where);
      this._dropOn = t || null;
    }
    _clearDrop() {
      if (this._dropOn) this._dropOn.thumb.removeAttribute('data-drop');
      this._dropOn = null;
    }
    _syncRail(follow) {
      if (!this._thumbs) return;
      this._thumbs.forEach(({
        thumb
      }, i) => {
        if (i === this._index) {
          thumb.setAttribute('data-current', '');
          if (follow && typeof thumb.scrollIntoView === 'function') {
            thumb.scrollIntoView({
              block: 'nearest'
            });
          }
        } else {
          thumb.removeAttribute('data-current');
        }
      });
    }
    _openMenu(i, x, y) {
      if (!this._menu) return;
      this._menuIndex = i;
      const slide = this._slides[i];
      const skip = slide && slide.hasAttribute('data-deck-skip');
      this._menu.querySelector('[data-act="skip"]').textContent = skip ? 'Unskip slide' : 'Skip slide';
      this._menu.querySelector('[data-act="up"]').disabled = i <= 0;
      this._menu.querySelector('[data-act="down"]').disabled = i >= this._slides.length - 1;
      this._menu.querySelector('[data-act="delete"]').disabled = this._slides.length <= 1;
      // Place, then clamp to viewport after it's measurable.
      this._menu.style.left = x + 'px';
      this._menu.style.top = y + 'px';
      this._menu.setAttribute('data-open', '');
      const r = this._menu.getBoundingClientRect();
      const nx = Math.min(x, window.innerWidth - r.width - 4);
      const ny = Math.min(y, window.innerHeight - r.height - 4);
      this._menu.style.left = Math.max(4, nx) + 'px';
      this._menu.style.top = Math.max(4, ny) + 'px';
    }
    _closeMenu() {
      if (this._menu) this._menu.removeAttribute('data-open');
      this._menuIndex = -1;
    }
    _openConfirm(i) {
      if (!this._confirm) return;
      this._confirmIndex = i;
      this._confirm.querySelector('.title').textContent = 'Delete slide ' + (i + 1) + '?';
      this._confirm.setAttribute('data-open', '');
      const btn = this._confirm.querySelector('.danger');
      if (btn && btn.focus) btn.focus();
    }
    _closeConfirm() {
      if (this._confirm) this._confirm.removeAttribute('data-open');
      this._confirmIndex = -1;
    }

    /** Rail mutations. When a dc-runtime is present (`window.__dcUpdate`)
     *  the host owns the light DOM — handlers emit a dc-op only and the
     *  host applies it (to the editor's model or to the source file) and
     *  re-renders via dc-runtime; slotchange catches the rail up.
     *  Structural ops lock rail input until the host acks so a rapid second
     *  click can't address a stale index; setAttr/removeAttr respect the
     *  lock but don't set it (indices unchanged; the host serializes).
     *  `newIndex` is written to location.hash so slotchange's
     *  _restoreIndex lands on the right slide.
     *
     *  With NO dc-runtime (a raw .html deck), there's no re-render path,
     *  so handlers self-mutate locally for an instant update and emit
     *  `emitOnly: false`; the host persists to disk without
     *  re-rendering over the already-mutated DOM.
     *
     *  See docs/dc-ops.md for the contract. */
    _emitDcOp(op, slide, lock, newIndex) {
      // Slide index (template/script/style filtered — same as
      // _collectSlides). deck-stage is a filtered-index dc-op emitter;
      // the host resolves against findDeckStage().slideTids. Callers
      // already pass `to` as a slide index.
      op.at = this._slides.indexOf(slide);
      op.witness = {
        childCount: this._slides.length
      };
      // dc-runtime wraps an <x-import>-mounted component in a
      // <div class="sc-host-x" data-dc-tpl="N"> host — the stamp is on the
      // WRAPPER, not this element. closest() finds it (or this element's
      // own stamp when directly templated).
      const host = this.closest('[data-dc-tpl]');
      const tid = host && host.getAttribute('data-dc-tpl');
      op.mount = {
        tid: tid !== null ? parseInt(tid, 10) : null,
        tag: 'deck-stage'
      };
      op.emitOnly = !!window.__dcUpdate;
      if (op.emitOnly) {
        if (lock) this._railLock = true;
        if (newIndex != null && newIndex !== this._index) {
          this._indexBeforeEmit = this._index;
          this._index = newIndex;
          try {
            history.replaceState(null, '', '#' + (newIndex + 1));
          } catch (e) {}
        }
      }
      this.dispatchEvent(new CustomEvent('dc-op', {
        detail: op,
        bubbles: true,
        composed: true
      }));
      return op.emitOnly;
    }
    _deleteSlide(i) {
      if (this._railLock) return;
      const slide = this._slides[i];
      if (!slide || this._slides.length <= 1) return;
      const cur = this._index;
      const ni = i < cur || i === cur && i === this._slides.length - 1 ? cur - 1 : cur;
      if (this._emitDcOp({
        op: 'remove'
      }, slide, true, ni)) return;
      this._index = ni;
      this._squelchSlotChange = true;
      slide.remove();
      this._collectSlides();
      this._applyIndex({
        showOverlay: true,
        broadcast: true,
        reason: 'mutation'
      });
    }
    _duplicateSlide(i) {
      if (this._railLock) return;
      const slide = this._slides[i];
      if (!slide) return;
      if (this._emitDcOp({
        op: 'duplicate'
      }, slide, true, i + 1)) return;
      const copy = slide.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      this._index = i + 1;
      this._squelchSlotChange = true;
      this.insertBefore(copy, slide.nextSibling);
      this._collectSlides();
      this._applyIndex({
        showOverlay: true,
        broadcast: true,
        reason: 'mutation'
      });
    }
    _toggleSkip(i) {
      if (this._railLock) return;
      const slide = this._slides[i];
      if (!slide) return;
      const on = !slide.hasAttribute('data-deck-skip');
      if (this._emitDcOp(on ? {
        op: 'setAttr',
        attr: 'data-deck-skip',
        value: ''
      } : {
        op: 'removeAttr',
        attr: 'data-deck-skip'
      }, slide, false)) return;
      if (on) slide.setAttribute('data-deck-skip', '');else slide.removeAttribute('data-deck-skip');
    }
    _skippedIndices() {
      const out = [];
      for (let i = 0; i < this._slides.length; i++) {
        if (this._slides[i].hasAttribute('data-deck-skip')) out.push(i);
      }
      return out;
    }
    _moveSlide(i, j) {
      if (this._railLock || j < 0 || j >= this._slides.length || j === i) return;
      const cur = this._index;
      const ni = cur === i ? j : i < cur && j >= cur ? cur - 1 : i > cur && j <= cur ? cur + 1 : cur;
      const slide = this._slides[i];
      if (this._emitDcOp({
        op: 'move',
        to: j
      }, slide, true, ni)) return;
      const ref = j < i ? this._slides[j] : this._slides[j].nextSibling;
      this._index = ni;
      this._squelchSlotChange = true;
      this.insertBefore(slide, ref);
      this._collectSlides();
      this._applyIndex({
        showOverlay: false,
        broadcast: true,
        reason: 'mutation'
      });
    }

    // Public API ------------------------------------------------------------

    /** Current slide index (0-based). */
    get index() {
      return this._index;
    }
    /** Total slide count. */
    get length() {
      return this._slides.length;
    }
    /** Programmatically navigate. */
    goTo(i) {
      this._go(i, 'api');
    }
    next() {
      this._advance(1, 'api');
    }
    prev() {
      this._advance(-1, 'api');
    }
    reset() {
      this._go(0, 'api');
    }
  }
  if (!customElements.get('deck-stage')) {
    customElements.define('deck-stage', DeckStage);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "decks/deck-stage.js", error: String((e && e.message) || e) }); }

// ui_kits/fund-portal/CompanyDetail.jsx
try { (() => {
/* Company detail screen for Haus Fund investor portal */

function CompanyDetail({
  company,
  onBack
}) {
  const {
    Button,
    Badge,
    Tag,
    StatCard
  } = window.HausFundDesignSystem_a048b8;
  const {
    Icon
  } = window;
  const stageVariant = {
    'Pre-seed': 'default',
    'Seed': 'forest',
    'Series A': 'bronze',
    'Series B': 'steel'
  };
  const accentBar = {
    steel: 'var(--steel-2)',
    forest: 'var(--forest-2)',
    bronze: 'var(--bronze-3)',
    default: 'var(--border-2)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      backgroundColor: 'var(--canvas-1)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: 'var(--canvas-0)',
      borderBottom: '1px solid var(--border-1)',
      padding: '18px 32px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--ink-3)',
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      padding: 0,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-left",
    size: 14,
    color: "var(--ink-3)"
  }), " Back to portfolio"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: 'var(--canvas-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--ink-2)',
      borderLeft: `4px solid ${accentBar[company.accent]}`,
      flexShrink: 0
    }
  }, company.initials), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-heading)',
      fontSize: 22,
      fontWeight: 700,
      color: 'var(--ink-1)',
      margin: '0 0 6px',
      lineHeight: 1
    }
  }, company.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: stageVariant[company.stage] || 'default'
  }, company.stage), /*#__PURE__*/React.createElement(Tag, {
    color: "default"
  }, company.sector), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      color: 'var(--ink-3)',
      fontSize: 12,
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 12,
    color: "var(--ink-4)"
  }), " ", company.location)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 13,
    color: "var(--ink-2)"
  }), " Website"), /*#__PURE__*/React.createElement(Button, {
    variant: "forest",
    size: "sm"
  }, "Add update")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Invested",
    value: company.invested,
    subvalue: company.date,
    accent: company.accent
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Valuation",
    value: company.valuation,
    subvalue: company.cohort,
    accent: "default"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Multiple",
    value: company.multiple,
    trend: "up",
    trendValue: "vs entry",
    accent: "bronze"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Portfolio co.",
    value: "#",
    subvalue: "of 14 companies",
    accent: "steel"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 300px',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: 'var(--canvas-0)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: 'var(--ink-4)',
      marginBottom: 10
    }
  }, "OVERVIEW"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 15,
      color: 'var(--ink-2)',
      lineHeight: 1.65,
      margin: 0
    }
  }, company.description)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, company.metrics.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      backgroundColor: 'var(--canvas-0)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 18px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      color: 'var(--ink-3)'
    }
  }, m.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--ink-1)'
    }
  }, m.value))))), /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: 'var(--canvas-0)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: 'var(--ink-4)',
      marginBottom: 12
    }
  }, "FOUNDERS"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, company.founders.split(',').map(f => f.trim()).map((founder, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      backgroundColor: 'var(--canvas-1)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      backgroundColor: 'var(--forest-5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--forest-2)'
    }
  }, founder.split(' ').filter(w => !w.includes('.')).map(w => w[0]).join('').slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--ink-1)'
    }
  }, founder)))))));
}
window.CompanyDetail = CompanyDetail;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fund-portal/CompanyDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fund-portal/Dashboard.jsx
try { (() => {
/* Dashboard screen — fund overview for Haus Fund investor portal */

function Dashboard({
  onSelectCompany,
  onNavigate
}) {
  const {
    Button,
    StatCard,
    Badge
  } = window.HausFundDesignSystem_a048b8;
  const {
    Icon
  } = window;
  const companies = (window.PORTFOLIO_COMPANIES || []).slice(0, 4);
  const activity = window.ACTIVITY || [];
  const accentVariants = {
    steel: 'steel',
    forest: 'forest',
    bronze: 'bronze',
    default: 'default'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      backgroundColor: 'var(--canvas-1)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: 'var(--canvas-0)',
      borderBottom: '1px solid var(--border-1)',
      padding: '18px 32px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: 'var(--ink-4)',
      marginBottom: 3,
      fontFamily: 'var(--font-mono)'
    }
  }, "HAUS FUND I \u2014 VINTAGE 2022"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-heading)',
      fontSize: 22,
      fontWeight: 700,
      color: 'var(--ink-1)',
      margin: 0,
      lineHeight: 1
    }
  }, "Dashboard")), /*#__PURE__*/React.createElement(Button, {
    variant: "forest",
    size: "sm",
    onClick: () => onNavigate('deal-flow')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13,
    color: "#fff"
  }), " New deal")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Fund Size",
    value: "$20M",
    subvalue: "Vintage 2022",
    accent: "forest"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Deployed",
    value: "$14.2M",
    trend: "up",
    trendValue: "+$1.8M QoQ",
    accent: "bronze"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Reserve",
    value: "$5.8M",
    subvalue: "29% remaining",
    accent: "steel"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Portfolio",
    value: "14",
    subvalue: "Across 4 sectors",
    accent: "default"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-heading)',
      fontSize: 17,
      fontWeight: 600,
      color: 'var(--ink-1)',
      margin: 0
    }
  }, "Recent investments"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate('portfolio'),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--forest-2)',
      fontSize: 13,
      fontFamily: 'var(--font-body)',
      fontWeight: 500
    }
  }, "View all ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 13,
    color: "var(--forest-2)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12
    }
  }, companies.map(co => /*#__PURE__*/React.createElement(MiniCompanyCard, {
    key: co.id,
    company: co,
    onClick: () => onSelectCompany(co)
  })))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-heading)',
      fontSize: 17,
      fontWeight: 600,
      color: 'var(--ink-1)',
      margin: '0 0 14px'
    }
  }, "Activity"), /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: 'var(--canvas-0)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-lg)'
    }
  }, activity.map((item, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '13px 18px',
      borderBottom: i < activity.length - 1 ? '1px solid var(--border-1)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      backgroundColor: 'var(--canvas-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: item.icon,
    size: 13,
    color: item.color
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      color: 'var(--ink-2)',
      lineHeight: 1.4
    }
  }, item.text), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--ink-4)',
      whiteSpace: 'nowrap'
    }
  }, item.time)))))));
}
function MiniCompanyCard({
  company,
  onClick
}) {
  const {
    Badge
  } = window.HausFundDesignSystem_a048b8;
  const [hov, setHov] = React.useState(false);
  const accentBar = {
    steel: 'var(--steel-2)',
    forest: 'var(--forest-2)',
    bronze: 'var(--bronze-3)',
    default: 'var(--border-2)'
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      backgroundColor: 'var(--canvas-0)',
      border: '1px solid var(--border-1)',
      borderTop: `3px solid ${accentBar[company.accent]}`,
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
      cursor: 'pointer',
      boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      transform: hov ? 'translateY(-1px)' : 'none',
      transition: 'box-shadow 150ms, transform 150ms',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'var(--canvas-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--ink-2)'
    }
  }, company.initials), /*#__PURE__*/React.createElement(Badge, {
    variant: "forest",
    size: "sm"
  }, company.stage)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-heading)',
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--ink-1)',
      marginBottom: 2
    }
  }, company.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      color: 'var(--ink-3)',
      lineHeight: 1.4
    }
  }, company.tagline)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink-1)'
    }
  }, company.invested), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--ink-4)'
    }
  }, company.date)));
}
window.Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fund-portal/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fund-portal/Data.jsx
try { (() => {
/* Shared data for Haus Fund UI Kit — 12 real residency houses */

const HOUSES = [{
  id: 'cell',
  name: 'CellHaus',
  city: 'Kobe, JP',
  thesis: 'Allogeneic Cell Therapy',
  bg: '#C4D8E8',
  color: '#2A587A',
  detail: "Beside the Kobe Biomedical Innovation Cluster — Japan's advanced cell-therapy regs + manufacturing."
}, {
  id: 'trial',
  name: 'TrialHaus',
  city: 'Australia',
  thesis: 'Clinical Trials',
  bg: '#C0E0D0',
  color: '#1A6850',
  detail: '43.5% R&D tax rebate + fast CTN approval for Phase I/II trials.'
}, {
  id: 'onc',
  name: 'OncHaus',
  city: 'New York',
  thesis: 'Oncology',
  bg: '#F0D890',
  color: '#7A5010',
  detail: 'Memorial Sloan Kettering + Columbia KOL network; dense pharma M&A ecosystem.'
}, {
  id: 'tool',
  name: 'ToolHaus',
  city: 'Boston',
  thesis: 'Tools Development',
  bg: '#C0CCD8',
  color: '#283858',
  detail: 'MIT/Harvard pipeline + Flagship ecosystem — densest biotech VC on earth.'
}, {
  id: 'bio',
  name: 'BioHaus',
  city: 'Mexico',
  thesis: 'Industrial Biotech',
  bg: '#A0D878',
  color: '#286820',
  detail: 'Low-cost biomanufacturing scale-up; US nearshoring tailwind.'
}, {
  id: 'pharm',
  name: 'PharmHaus',
  city: 'Puerto Rico',
  thesis: 'Pharma Manufacturing',
  bg: '#D4E8F4',
  color: '#2A5888',
  detail: 'Act 60 tax + J&J / Amgen / AbbVie infrastructure under US jurisdiction.'
}, {
  id: 'diag',
  name: 'DiagHaus',
  city: 'United Kingdom',
  thesis: 'Diagnostics',
  bg: '#E8C4C4',
  color: '#782030',
  detail: 'Wellcome Trust + CEPI; progressive challenge-trial framework.'
}, {
  id: 'desci',
  name: 'DeSciHaus',
  city: 'Buenos Aires',
  thesis: 'DeSci / Agriculture',
  bg: '#B8D898',
  color: '#2A6018',
  detail: 'DeSci community + agri-biotech opportunity in Southern Cone.'
}, {
  id: 'lux',
  name: 'LuxHaus',
  city: 'Paris',
  thesis: 'Luxury Technology',
  bg: '#F0E0B0',
  color: '#7A5810',
  detail: 'LVMH ecosystem + French engineering grandes écoles.'
}, {
  id: 'sensor',
  name: 'SensorHaus',
  city: 'Zurich',
  thesis: 'Sensor Development',
  bg: '#D4D8E4',
  color: '#404858',
  detail: 'ETH Zurich precision-engineering pipeline.'
}, {
  id: 'cro',
  name: 'CROHaus',
  city: 'Shanghai',
  thesis: 'Contract Research',
  bg: '#F0C8C0',
  color: '#782820',
  detail: 'China CRO market + NMPA regulatory strategy.'
}, {
  id: 'fab',
  name: 'FabHaus',
  city: 'Shenzhen',
  thesis: 'Fabrication',
  bg: '#C8D4E4',
  color: '#3A4E6A',
  detail: 'Deep hardware supply chain + PCB/PCBA manufacturing density.'
}];
const PORTFOLIO_COMPANIES = [{
  id: 'quantum-arc',
  name: 'Quantum Arc',
  initials: 'QA',
  tagline: 'Quantum error correction for near-term QPUs',
  sector: 'Quantum Computing',
  stage: 'Seed',
  invested: '$1.5M',
  valuation: '$12M',
  multiple: '1.2×',
  date: 'Mar 2023',
  house: 'SensorHaus',
  status: 'active',
  founders: 'Dr. Maya Chen, Amir Siddiqui',
  location: 'Zurich, CH',
  description: 'Quantum Arc develops fault-tolerant error correction protocols for near-term quantum processors. Their surface code compiler reduces logical error rates by 40× on current hardware.',
  accent: '#D4D8E4',
  accentText: '#404858',
  metrics: [{
    label: 'Patents',
    value: '3'
  }, {
    label: 'QPU partners',
    value: '2'
  }, {
    label: 'ARR',
    value: '$0.8M'
  }]
}, {
  id: 'biofab-systems',
  name: 'Biofab Systems',
  initials: 'BF',
  tagline: 'Automated cell-free protein synthesis at scale',
  sector: 'Synthetic Biology',
  stage: 'Series A',
  invested: '$2.2M',
  valuation: '$28M',
  multiple: '2.8×',
  date: 'Aug 2022',
  house: 'CellHaus',
  status: 'active',
  founders: 'Dr. Priya Nair, Leo Svensson',
  location: 'Kobe, JP',
  description: 'Biofab Systems automates protein synthesis using cell-free expression systems, enabling rapid prototyping of novel biologics at 10× lower cost than traditional bioreactors.',
  accent: '#C4D8E8',
  accentText: '#2A587A',
  metrics: [{
    label: 'Lab partners',
    value: '14'
  }, {
    label: 'Proteins synth.',
    value: '2,400+'
  }, {
    label: 'ARR',
    value: '$3.2M'
  }]
}, {
  id: 'ceramesh',
  name: 'CeraMesh',
  initials: 'CM',
  tagline: 'Structural ceramics with embedded sensor networks',
  sector: 'Advanced Materials',
  stage: 'Seed',
  invested: '$1.2M',
  valuation: '$8M',
  multiple: '1.4×',
  date: 'Jan 2023',
  house: 'FabHaus',
  status: 'active',
  founders: 'Dr. Yuki Tanaka, Felix Meyer',
  location: 'Shenzhen, CN',
  description: 'CeraMesh embeds micro-sensor networks into structural ceramics during sintering, enabling real-time stress and temperature monitoring in industrial environments without external sensors.',
  accent: '#C8D4E4',
  accentText: '#3A4E6A',
  metrics: [{
    label: 'Pilot installs',
    value: '7'
  }, {
    label: 'Temp. range',
    value: '1400°C'
  }, {
    label: 'ARR',
    value: '$0.4M'
  }]
}, {
  id: 'novacatalyst',
  name: 'NovaCatalyst',
  initials: 'NC',
  tagline: 'AI-designed catalysts for green chemistry',
  sector: 'Green Chemistry',
  stage: 'Pre-seed',
  invested: '$0.6M',
  valuation: '$3M',
  multiple: '1.1×',
  date: 'Jun 2023',
  house: 'BioHaus',
  status: 'active',
  founders: 'Dr. Inês Ribeiro',
  location: 'Mexico City, MX',
  description: 'NovaCatalyst uses generative AI to design novel transition metal catalysts that replace rare earth materials in hydrogenation reactions, reducing catalyst costs by up to 80%.',
  accent: '#A0D878',
  accentText: '#286820',
  metrics: [{
    label: 'Catalyst designs',
    value: '340'
  }, {
    label: 'Selectivity gain',
    value: '+22%'
  }, {
    label: 'Pilots',
    value: '2'
  }]
}, {
  id: 'axiom-robotics',
  name: 'Axiom Robotics',
  initials: 'AR',
  tagline: 'Adaptive robotic arms for unstructured environments',
  sector: 'Robotics',
  stage: 'Seed',
  invested: '$1.4M',
  valuation: '$11M',
  multiple: '1.6×',
  date: 'Nov 2022',
  house: 'ToolHaus',
  status: 'active',
  founders: 'Jana Kovač, Dr. Samuel Obi',
  location: 'Boston, MA',
  description: 'Axiom builds robotic manipulation systems that adapt to unstructured environments using real-time force feedback and vision. Deployed in 3 tier-1 auto suppliers.',
  accent: '#C0CCD8',
  accentText: '#283858',
  metrics: [{
    label: 'Units deployed',
    value: '12'
  }, {
    label: 'Uptime',
    value: '99.1%'
  }, {
    label: 'ARR',
    value: '$1.6M'
  }]
}, {
  id: 'luminary-energy',
  name: 'Luminary Energy',
  initials: 'LE',
  tagline: 'Solid-state batteries using sulfide electrolytes',
  sector: 'Energy Storage',
  stage: 'Seed',
  invested: '$1.3M',
  valuation: '$9M',
  multiple: '1.3×',
  date: 'May 2023',
  house: 'TrialHaus',
  status: 'active',
  founders: 'Dr. Clara Wolff, Remy Durand',
  location: 'Sydney, AU',
  description: 'Luminary Energy produces solid-state batteries achieving 400 Wh/kg energy density — 2× current lithium-ion — using a proprietary dry electrode process compatible with existing lines.',
  accent: '#C0E0D0',
  accentText: '#1A6850',
  metrics: [{
    label: 'Energy density',
    value: '400 Wh/kg'
  }, {
    label: 'Cycles tested',
    value: '1,200'
  }, {
    label: 'Pilots',
    value: '3'
  }]
}];
const DEAL_FLOW = [{
  id: 'df1',
  name: 'Helion Materials',
  sector: 'Advanced Materials',
  stage: 'submitted',
  date: 'Jun 10',
  lead: 'Sarah K.',
  house: 'FabHaus'
}, {
  id: 'df2',
  name: 'ColdFusion Labs',
  sector: 'Energy',
  stage: 'submitted',
  date: 'Jun 8',
  lead: 'Mark T.',
  house: 'TrialHaus'
}, {
  id: 'df3',
  name: 'Auxetic Bio',
  sector: 'Synthetic Biology',
  stage: 'screening',
  date: 'May 28',
  lead: 'Sarah K.',
  house: 'CellHaus'
}, {
  id: 'df4',
  name: 'PhotonPath',
  sector: 'Photonics',
  stage: 'screening',
  date: 'May 20',
  lead: 'James L.',
  house: 'SensorHaus'
}, {
  id: 'df5',
  name: 'CrystalMind',
  sector: 'Quantum Computing',
  stage: 'diligence',
  date: 'May 5',
  lead: 'Mark T.',
  house: 'SensorHaus'
}, {
  id: 'df6',
  name: 'Celluform',
  sector: 'Biotech',
  stage: 'diligence',
  date: 'Apr 18',
  lead: 'Sarah K.',
  house: 'CellHaus'
}, {
  id: 'df7',
  name: 'Ferronika',
  sector: 'Materials',
  stage: 'term-sheet',
  date: 'Apr 2',
  lead: 'James L.',
  house: 'FabHaus'
}];
const ACTIVITY = [{
  icon: 'trending-up',
  text: 'Biofab Systems (CellHaus) closed Series A — $2.2M invested',
  time: '2 days ago',
  color: 'var(--positive)'
}, {
  icon: 'dollar-sign',
  text: 'Monthly LP report sent for May 2024',
  time: '5 days ago',
  color: 'var(--bronze-3)'
}, {
  icon: 'check',
  text: 'Quantum Arc (SensorHaus): first QPU partnership signed',
  time: '1 week ago',
  color: 'var(--forest-3)'
}, {
  icon: 'building-2',
  text: 'Luminary Energy (TrialHaus) achieved 400 Wh/kg milestone',
  time: '2 weeks ago',
  color: 'var(--steel-3)'
}, {
  icon: 'calendar',
  text: 'FabHaus Shenzhen cohort applications closed — 7 submitted',
  time: '3 weeks ago',
  color: 'var(--ink-3)'
}];
window.HOUSES = HOUSES;
window.PORTFOLIO_COMPANIES = PORTFOLIO_COMPANIES;
window.DEAL_FLOW = DEAL_FLOW;
window.ACTIVITY = ACTIVITY;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fund-portal/Data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fund-portal/DealFlow.jsx
try { (() => {
/* Deal flow pipeline screen for Haus Fund investor portal */

function DealFlow() {
  const {
    Badge,
    Button
  } = window.HausFundDesignSystem_a048b8;
  const {
    Icon
  } = window;
  const deals = window.DEAL_FLOW || [];
  const stages = [{
    id: 'submitted',
    label: 'Submitted',
    color: 'var(--ink-4)',
    bgColor: 'var(--canvas-2)'
  }, {
    id: 'screening',
    label: 'Screening',
    color: 'var(--steel-2)',
    bgColor: 'var(--steel-5)'
  }, {
    id: 'diligence',
    label: 'Due Diligence',
    color: 'var(--bronze-1)',
    bgColor: 'var(--bronze-5)'
  }, {
    id: 'term-sheet',
    label: 'Term Sheet',
    color: 'var(--forest-2)',
    bgColor: 'var(--forest-5)'
  }];
  const dealsByStage = stages.reduce((acc, s) => {
    acc[s.id] = deals.filter(d => d.stage === s.id);
    return acc;
  }, {});
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      backgroundColor: 'var(--canvas-1)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: 'var(--canvas-0)',
      borderBottom: '1px solid var(--border-1)',
      padding: '18px 32px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: 'var(--ink-4)',
      marginBottom: 3,
      fontFamily: 'var(--font-mono)'
    }
  }, "COHORT 3 \xB7 OPEN"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-heading)',
      fontSize: 22,
      fontWeight: 700,
      color: 'var(--ink-1)',
      margin: 0
    }
  }, "Deal Flow")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "filter",
    size: 13,
    color: "var(--ink-2)"
  }), " Filter"), /*#__PURE__*/React.createElement(Button, {
    variant: "forest",
    size: "sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13,
    color: "#fff"
  }), " Add deal"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14,
      flex: 1
    }
  }, stages.map(stage => /*#__PURE__*/React.createElement("div", {
    key: stage.id,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 12px',
      backgroundColor: stage.bgColor,
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${stage.color}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      fontWeight: 600,
      color: stage.color
    }
  }, stage.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: stage.color,
      opacity: 0.7
    }
  }, dealsByStage[stage.id].length)), dealsByStage[stage.id].map(deal => /*#__PURE__*/React.createElement(DealCard, {
    key: deal.id,
    deal: deal,
    stageColor: stage.color
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '8px',
      borderRadius: 'var(--radius-sm)',
      border: '1px dashed var(--border-2)',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      color: 'var(--ink-4)',
      fontFamily: 'var(--font-body)',
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 12,
    color: "var(--ink-4)"
  }), " Add")))));
}
function DealCard({
  deal,
  stageColor
}) {
  const [hov, setHov] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      backgroundColor: 'var(--canvas-0)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      cursor: 'pointer',
      boxShadow: hov ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
      transform: hov ? 'translateY(-1px)' : 'none',
      transition: 'box-shadow 120ms, transform 120ms',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink-1)'
    }
  }, deal.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      color: 'var(--ink-3)'
    }
  }, deal.sector), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--ink-4)'
    }
  }, deal.date), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      backgroundColor: 'var(--canvas-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--ink-3)'
    }
  }, deal.lead.split(' ').map(w => w[0]).join('')))));
}
window.DealFlow = DealFlow;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fund-portal/DealFlow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fund-portal/Icons.jsx
try { (() => {
/* Lucide-based Icon component for Haus Fund UI Kit (MIT-licensed paths) */

const ICON_SVG = {
  'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  'briefcase': '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  'git-branch': '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  'trending-down': '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  'dollar-sign': '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  'activity': '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  'building-2': '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  'filter': '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  'calendar': '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'
};
function Icon({
  name,
  size = 18,
  color = 'currentColor',
  style
}) {
  const content = ICON_SVG[name] || '';
  return /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0,
      display: 'block',
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: content
    }
  });
}
window.Icon = Icon;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fund-portal/Icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fund-portal/LocalComponents.jsx
try { (() => {
/* LocalComponents.jsx — self-contained DS components for the Haus Fund UI Kit
 * Mirrors components/core/* without requiring the compiled _ds_bundle.js
 */

function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  fullWidth = false
}) {
  const [hov, setHov] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const sizes = {
    sm: {
      padding: '0 12px',
      height: '32px',
      fontSize: '12px',
      borderRadius: '4px'
    },
    md: {
      padding: '0 18px',
      height: '40px',
      fontSize: '14px',
      borderRadius: '6px'
    },
    lg: {
      padding: '0 24px',
      height: '48px',
      fontSize: '15px',
      borderRadius: '6px'
    }
  };
  const variants = {
    primary: {
      background: hov ? '#3A3A3A' : '#0D0D0D',
      color: '#fff',
      border: 'none'
    },
    secondary: {
      background: hov ? '#E5E1D9' : '#F0EDE6',
      color: '#0D0D0D',
      border: 'none'
    },
    ghost: {
      background: hov ? '#F0EDE6' : 'transparent',
      color: '#3A3A3A',
      border: 'none'
    },
    outline: {
      background: hov ? '#F0EDE6' : 'transparent',
      color: '#0D0D0D',
      border: '1.5px solid #CECAC1'
    },
    forest: {
      background: hov ? '#2A5C46' : '#1C3B2D',
      color: '#fff',
      border: 'none'
    },
    bronze: {
      background: hov ? '#9A7040' : '#B8924A',
      color: '#fff',
      border: 'none'
    },
    danger: {
      background: hov ? '#a02a2a' : '#B83232',
      color: '#fff',
      border: 'none'
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => {
      setHov(false);
      setPressed(false);
    },
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '7px',
      fontFamily: "'DM Sans', sans-serif",
      fontWeight: 600,
      letterSpacing: '0.01em',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      outline: 'none',
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      transition: 'background 120ms, transform 80ms',
      transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
      width: fullWidth ? '100%' : 'auto',
      ...sizes[size],
      ...variants[variant]
    }
  }, children);
}
function Badge({
  children,
  variant = 'default',
  size = 'md'
}) {
  const variants = {
    default: {
      background: '#F0EDE6',
      color: '#3A3A3A'
    },
    primary: {
      background: '#0D0D0D',
      color: '#fff'
    },
    forest: {
      background: '#BDDDD3',
      color: '#1C3B2D'
    },
    bronze: {
      background: '#F2E8D5',
      color: '#6B4E2A'
    },
    steel: {
      background: '#C8DFEF',
      color: '#1A3D5C'
    },
    positive: {
      background: '#D8F0E5',
      color: '#1B7A48'
    },
    warning: {
      background: '#FDF0D5',
      color: '#C47A1A'
    },
    negative: {
      background: '#F5D5D5',
      color: '#B83232'
    },
    info: {
      background: '#D5E5F8',
      color: '#1A4E8A'
    }
  };
  const sizes = {
    sm: {
      padding: '2px 6px',
      fontSize: '10px',
      borderRadius: '2px',
      height: '18px'
    },
    md: {
      padding: '3px 8px',
      fontSize: '11px',
      borderRadius: '4px',
      height: '22px'
    },
    lg: {
      padding: '4px 10px',
      fontSize: '12px',
      borderRadius: '4px',
      height: '26px'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: "'DM Sans', sans-serif",
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      ...variants[variant],
      ...sizes[size]
    }
  }, children);
}
function Tag({
  children,
  color = 'default',
  onRemove,
  onClick
}) {
  const [hov, setHov] = React.useState(false);
  const colors = {
    default: {
      background: hov ? '#E5E1D9' : '#F0EDE6',
      color: '#3A3A3A',
      borderColor: '#CECAC1'
    },
    forest: {
      background: '#BDDDD3',
      color: '#1C3B2D',
      borderColor: 'rgba(28,59,45,0.2)'
    },
    bronze: {
      background: '#F2E8D5',
      color: '#6B4E2A',
      borderColor: 'rgba(184,146,74,0.25)'
    },
    steel: {
      background: '#C8DFEF',
      color: '#1A3D5C',
      borderColor: 'rgba(26,61,92,0.2)'
    },
    ink: {
      background: '#0D0D0D',
      color: '#fff',
      borderColor: '#0D0D0D'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '4px',
      border: '1px solid',
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.4,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background 120ms',
      ...colors[color]
    }
  }, children, onRemove && /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onRemove();
    },
    style: {
      background: 'none',
      border: 'none',
      padding: '0 1px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      color: 'inherit',
      opacity: 0.5,
      fontSize: '14px',
      lineHeight: 1
    }
  }, "\xD7"));
}
function Avatar({
  name,
  src,
  size = 'md',
  variant = 'default',
  shape = 'circle'
}) {
  const sizes = {
    xs: {
      dim: 24,
      fontSize: '9px'
    },
    sm: {
      dim: 32,
      fontSize: '12px'
    },
    md: {
      dim: 40,
      fontSize: '14px'
    },
    lg: {
      dim: 56,
      fontSize: '18px'
    },
    xl: {
      dim: 72,
      fontSize: '24px'
    }
  };
  const variants = {
    default: {
      background: '#E5E1D9',
      color: '#3A3A3A'
    },
    forest: {
      background: '#BDDDD3',
      color: '#1C3B2D'
    },
    bronze: {
      background: '#F2E8D5',
      color: '#6B4E2A'
    },
    steel: {
      background: '#C8DFEF',
      color: '#1A3D5C'
    },
    dark: {
      background: '#0D0D0D',
      color: '#fff'
    },
    forest_dark: {
      background: '#1C3B2D',
      color: '#fff'
    }
  };
  const initials = name ? name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';
  const {
    dim,
    fontSize
  } = sizes[size];
  const borderRadius = shape === 'circle' ? '50%' : shape === 'rounded' ? '6px' : '4px';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: dim,
      height: dim,
      borderRadius,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      fontSize,
      fontWeight: 700,
      flexShrink: 0,
      overflow: 'hidden',
      ...variants[variant]
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name || '',
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
function Card({
  children,
  padding = 'md',
  shadow = 'sm',
  radius = 'md',
  border = true,
  background,
  onClick,
  style
}) {
  const [hov, setHov] = React.useState(false);
  const isClickable = typeof onClick === 'function';
  const paddings = {
    none: '0',
    sm: '12px',
    md: '20px',
    lg: '28px',
    xl: '40px'
  };
  const shadows = {
    none: 'none',
    xs: '0 1px 2px rgba(13,13,13,0.06)',
    sm: '0 1px 4px rgba(13,13,13,0.06)',
    md: '0 4px 12px rgba(13,13,13,0.08)',
    lg: '0 8px 24px rgba(13,13,13,0.10)'
  };
  const radii = {
    none: '0',
    sm: '4px',
    md: '10px',
    lg: '16px',
    xl: '24px'
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => isClickable && setHov(true),
    onMouseLeave: () => isClickable && setHov(false),
    style: {
      backgroundColor: background || '#fff',
      padding: paddings[padding],
      boxShadow: isClickable && hov ? '0 4px 12px rgba(13,13,13,0.08)' : shadows[shadow],
      borderRadius: radii[radius],
      border: border ? '1px solid #E5E1D9' : 'none',
      cursor: isClickable ? 'pointer' : 'default',
      transition: 'box-shadow 160ms, transform 120ms',
      transform: isClickable && hov ? 'translateY(-1px)' : 'translateY(0)',
      ...style
    }
  }, children);
}
function StatCard({
  label,
  value,
  subvalue,
  trend,
  trendValue,
  accent = 'default'
}) {
  const tops = {
    default: '#CECAC1',
    forest: '#1C3B2D',
    bronze: '#B8924A',
    steel: '#1A3D5C'
  };
  const trendC = {
    up: '#1B7A48',
    down: '#B83232',
    flat: '#727272'
  };
  const arrows = {
    up: '↑',
    down: '↓',
    flat: '→'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: '#fff',
      border: '1px solid #E5E1D9',
      borderTop: `3px solid ${tops[accent]}`,
      borderRadius: '10px',
      padding: '20px 24px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#727272'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Barlow Condensed', 'Barlow', sans-serif",
      fontSize: '36px',
      fontWeight: 700,
      lineHeight: 1.05,
      color: '#0D0D0D',
      letterSpacing: '-0.01em'
    }
  }, value), (subvalue || trend && trendValue) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '2px'
    }
  }, subvalue && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '13px',
      color: '#727272'
    }
  }, subvalue), trend && trendValue && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '13px',
      fontWeight: 600,
      color: trendC[trend]
    }
  }, arrows[trend], " ", trendValue)));
}
function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  error,
  hint,
  disabled = false,
  size = 'md',
  prefix,
  suffix,
  required = false
}) {
  const [focused, setFocused] = React.useState(false);
  const sizes = {
    sm: {
      height: '32px',
      fontSize: '13px',
      px: '10px'
    },
    md: {
      height: '40px',
      fontSize: '14px',
      px: '12px'
    },
    lg: {
      height: '48px',
      fontSize: '15px',
      px: '14px'
    }
  };
  const sz = sizes[size];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '13px',
      fontWeight: 600,
      color: '#3A3A3A'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#B83232',
      marginLeft: '3px'
    }
  }, "*")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'stretch',
      height: sz.height,
      borderRadius: '6px',
      border: `1px solid ${error ? '#B83232' : focused ? '#727272' : '#CECAC1'}`,
      backgroundColor: disabled ? '#F0EDE6' : '#fff',
      overflow: 'hidden',
      boxShadow: focused && !error ? '0 0 0 3px #E5E1D9' : 'none',
      transition: 'border-color 140ms, box-shadow 140ms'
    }
  }, prefix && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `0 ${sz.px}`,
      display: 'flex',
      alignItems: 'center',
      fontSize: sz.fontSize,
      color: '#727272',
      background: '#F0EDE6',
      borderRight: '1px solid #E5E1D9',
      flexShrink: 0
    }
  }, prefix), /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    required: required,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      flex: 1,
      height: '100%',
      border: 'none',
      outline: 'none',
      padding: `0 ${sz.px}`,
      fontSize: sz.fontSize,
      fontFamily: "'DM Sans', sans-serif",
      color: '#0D0D0D',
      background: 'transparent',
      cursor: disabled ? 'not-allowed' : 'text'
    }
  }), suffix && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `0 ${sz.px}`,
      display: 'flex',
      alignItems: 'center',
      fontSize: sz.fontSize,
      color: '#727272',
      background: '#F0EDE6',
      borderLeft: '1px solid #E5E1D9',
      flexShrink: 0
    }
  }, suffix)), (error || hint) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '12px',
      color: error ? '#B83232' : '#727272'
    }
  }, error || hint));
}
function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  error,
  hint,
  disabled = false,
  size = 'md',
  required = false
}) {
  const sizes = {
    sm: {
      height: '32px',
      fontSize: '13px',
      px: '10px'
    },
    md: {
      height: '40px',
      fontSize: '14px',
      px: '12px'
    },
    lg: {
      height: '48px',
      fontSize: '15px',
      px: '14px'
    }
  };
  const sz = sizes[size];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '13px',
      fontWeight: 600,
      color: '#3A3A3A'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#B83232',
      marginLeft: '3px'
    }
  }, "*")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: onChange,
    disabled: disabled,
    required: required,
    style: {
      width: '100%',
      height: sz.height,
      padding: `0 36px 0 ${sz.px}`,
      border: `1px solid ${error ? '#B83232' : '#CECAC1'}`,
      borderRadius: '6px',
      background: disabled ? '#F0EDE6' : '#fff',
      color: value ? '#0D0D0D' : '#B0ADA6',
      fontSize: sz.fontSize,
      fontFamily: "'DM Sans', sans-serif",
      cursor: disabled ? 'not-allowed' : 'pointer',
      appearance: 'none',
      outline: 'none'
    }
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options.map(opt => {
    const v = typeof opt === 'string' ? opt : opt.value;
    const l = typeof opt === 'string' ? opt : opt.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      color: '#727272',
      fontSize: '11px'
    }
  }, "\u25BE")), (error || hint) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '12px',
      color: error ? '#B83232' : '#727272'
    }
  }, error || hint));
}

// Expose under the DS namespace so portal screens work without the compiled bundle
window.HausFundDesignSystem_a048b8 = {
  Button,
  Badge,
  Tag,
  Avatar,
  Card,
  StatCard,
  Input,
  Select
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fund-portal/LocalComponents.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fund-portal/Portfolio.jsx
try { (() => {
/* Portfolio list screen — all portfolio companies */

function Portfolio({
  onSelectCompany
}) {
  const {
    Badge,
    Tag
  } = window.HausFundDesignSystem_a048b8;
  const {
    Icon
  } = window;
  const companies = window.PORTFOLIO_COMPANIES || [];
  const [query, setQuery] = React.useState('');
  const [sectorFilter, setSectorFilter] = React.useState('All');
  const sectors = ['All', ...Array.from(new Set(companies.map(c => c.sector)))];
  const filtered = companies.filter(c => (sectorFilter === 'All' || c.sector === sectorFilter) && (query === '' || c.name.toLowerCase().includes(query.toLowerCase()) || c.sector.toLowerCase().includes(query.toLowerCase())));
  const stageVariant = {
    'Pre-seed': 'default',
    'Seed': 'forest',
    'Series A': 'bronze',
    'Series B': 'steel'
  };
  const accentBar = {
    steel: 'var(--steel-2)',
    forest: 'var(--forest-2)',
    bronze: 'var(--bronze-3)',
    default: 'var(--border-2)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      backgroundColor: 'var(--canvas-1)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: 'var(--canvas-0)',
      borderBottom: '1px solid var(--border-1)',
      padding: '18px 32px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-heading)',
      fontSize: 22,
      fontWeight: 700,
      color: 'var(--ink-1)',
      margin: 0
    }
  }, "Portfolio"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--ink-3)'
    }
  }, filtered.length, " companies")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'var(--canvas-1)',
      border: '1px solid var(--border-2)',
      borderRadius: 'var(--radius-md)',
      padding: '0 12px',
      height: 36,
      flex: 1,
      maxWidth: 300
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 14,
    color: "var(--ink-4)"
  }), /*#__PURE__*/React.createElement("input", {
    value: query,
    onChange: e => setQuery(e.target.value),
    placeholder: "Search companies\u2026",
    style: {
      border: 'none',
      outline: 'none',
      backgroundColor: 'transparent',
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      color: 'var(--ink-1)',
      width: '100%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, sectors.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => setSectorFilter(s),
    style: {
      padding: '4px 10px',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${sectorFilter === s ? 'var(--forest-2)' : 'var(--border-2)'}`,
      backgroundColor: sectorFilter === s ? 'var(--forest-5)' : 'transparent',
      color: sectorFilter === s ? 'var(--forest-2)' : 'var(--ink-3)',
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer'
    }
  }, s))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundColor: 'var(--canvas-0)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
      gap: 0,
      padding: '10px 18px',
      borderBottom: '1px solid var(--border-1)',
      backgroundColor: 'var(--canvas-1)'
    }
  }, ['Company', 'Sector', 'Stage', 'Invested', 'Date'].map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--ink-4)'
    }
  }, h))), filtered.map((co, i) => /*#__PURE__*/React.createElement(PortfolioRow, {
    key: co.id,
    company: co,
    onClick: () => onSelectCompany(co),
    isLast: i === filtered.length - 1,
    accentBar: accentBar,
    stageVariant: stageVariant
  })))));
}
function PortfolioRow({
  company,
  onClick,
  isLast,
  accentBar,
  stageVariant
}) {
  const {
    Badge
  } = window.HausFundDesignSystem_a048b8;
  const [hov, setHov] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
      gap: 0,
      padding: '13px 18px',
      borderBottom: isLast ? 'none' : '1px solid var(--border-1)',
      cursor: 'pointer',
      backgroundColor: hov ? 'var(--canvas-1)' : 'transparent',
      transition: 'background-color 100ms',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 6,
      backgroundColor: 'var(--canvas-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--ink-2)',
      borderLeft: `3px solid ${accentBar[company.accent]}`,
      flexShrink: 0
    }
  }, company.initials), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink-1)'
    }
  }, company.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      color: 'var(--ink-4)'
    }
  }, company.cohort))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      color: 'var(--ink-3)'
    }
  }, company.sector), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    variant: stageVariant[company.stage] || 'default',
    size: "sm"
  }, company.stage)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink-1)'
    }
  }, company.invested), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--ink-4)'
    }
  }, company.date));
}
window.Portfolio = Portfolio;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fund-portal/Portfolio.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fund-portal/Sidebar.jsx
try { (() => {
/* Sidebar navigation component for Haus Fund investor portal */

function Sidebar({
  activeScreen,
  onNavigate
}) {
  const {
    Icon
  } = window;
  const navItems = [{
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'layout-dashboard'
  }, {
    id: 'portfolio',
    label: 'Portfolio',
    icon: 'briefcase'
  }, {
    id: 'deal-flow',
    label: 'Deal Flow',
    icon: 'git-branch'
  }, {
    id: 'reports',
    label: 'Reports',
    icon: 'file-text'
  }, {
    id: 'lps',
    label: 'Limited Partners',
    icon: 'users'
  }];
  const [hoveredItem, setHoveredItem] = React.useState(null);
  const navBtnStyle = id => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: activeScreen === id ? 'rgba(255,255,255,0.13)' : hoveredItem === id ? 'rgba(255,255,255,0.06)' : 'transparent',
    color: activeScreen === id ? '#ffffff' : 'rgba(255,255,255,0.52)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: activeScreen === id ? 500 : 400,
    transition: 'background-color 120ms, color 120ms',
    width: '100%',
    textAlign: 'left'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 240,
      minWidth: 240,
      height: '100vh',
      backgroundColor: '#1C3B2D',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 20px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-white.svg",
    alt: "HAUS",
    style: {
      height: 34,
      objectFit: 'contain'
    }
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      padding: '10px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, navItems.map(item => /*#__PURE__*/React.createElement("button", {
    key: item.id,
    onClick: () => onNavigate(item.id),
    onMouseEnter: () => setHoveredItem(item.id),
    onMouseLeave: () => setHoveredItem(null),
    style: navBtnStyle(item.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: item.icon,
    size: 16,
    color: activeScreen === item.id ? '#fff' : 'rgba(255,255,255,0.52)'
  }), item.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 8px 10px',
      padding: '12px 14px',
      backgroundColor: 'rgba(0,0,0,0.22)',
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.35)',
      marginBottom: 5,
      fontFamily: 'var(--font-mono)'
    }
  }, "HAUS FUND I"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 700,
      color: '#fff',
      fontFamily: 'var(--font-display)',
      letterSpacing: '-0.01em',
      lineHeight: 1.1
    }
  }, "$20M"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.42)',
      marginTop: 4,
      lineHeight: 1.4
    }
  }, "$14.2M deployed", /*#__PURE__*/React.createElement("br", null), "14 companies \xB7 2022")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px',
      borderTop: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {},
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      borderRadius: 6,
      border: 'none',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      color: 'rgba(255,255,255,0.35)',
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      width: '100%',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 15,
    color: "rgba(255,255,255,0.35)"
  }), "Settings")));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fund-portal/Sidebar.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

})();
