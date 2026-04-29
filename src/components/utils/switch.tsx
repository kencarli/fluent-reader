import * as React from "react"

type SwitchProps = {
    checked?: boolean
    onChange?: (checked: boolean) => void
    label?: string
    inlineLabel?: boolean
    disabled?: boolean
    styles?: any
}

/**
 * 自定义 Switch 组件
 * 用于替代 Fluent UI 的 Toggle，解决在 Tauri WebView 中点击无效的问题
 */
class Switch extends React.Component<SwitchProps> {
    private switchRef: HTMLDivElement | null = null

    componentDidMount() {
        // 使用原生 DOM 事件而不是 React 合成事件
        // 只在 capture 阶段监听 mousedown，避免触发两次
        if (this.switchRef) {
            this.switchRef.addEventListener('mousedown', this.handleNativeMouseDown, true)
        }
    }

    componentWillUnmount() {
        if (this.switchRef) {
            this.switchRef.removeEventListener('mousedown', this.handleNativeMouseDown, true)
        }
    }

    private handleNativeMouseDown = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        if (!this.props.disabled && this.props.onChange) {
            this.props.onChange(!this.props.checked)
        }
    }

    private handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!this.props.disabled && this.props.onChange) {
                this.props.onChange(!this.props.checked)
            }
        }
    }

    render() {
        const { checked = false, label, inlineLabel = false, disabled = false, styles = {} } = this.props
        const switchStyle: React.CSSProperties = {
            position: 'relative',
            width: 40,
            height: 20,
            backgroundColor: checked ? 'var(--themePrimary, #0078d4)' : 'var(--neutralTertiaryAlt, #a6a6a6)',
            borderRadius: 10,
            transition: 'background-color 0.2s ease',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            outline: 'none',
        }

        const thumbStyle: React.CSSProperties = {
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            width: 16,
            height: 16,
            backgroundColor: 'white',
            borderRadius: '50%',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            transition: 'left 0.2s ease',
            pointerEvents: 'none',
        }

        const labelStyle: React.CSSProperties = {
            fontSize: 14,
            color: 'var(--neutralPrimary, #323130)',
            display: inlineLabel ? 'inline' : 'block',
            marginBottom: inlineLabel ? 0 : 4,
            marginLeft: inlineLabel ? 4 : 0,
            ...(styles.label || {}),
        }

        const containerStyle: React.CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: disabled ? 'not-allowed' : 'pointer',
            userSelect: 'none',
            ...(styles.root || {}),
        }

        return (
            <div style={containerStyle}>
                <div
                    ref={el => { this.switchRef = el }}
                    style={{...switchStyle, position: 'relative', cursor: 'pointer'}}
                    tabIndex={disabled ? -1 : 0}
                    role="switch"
                    aria-checked={checked}
                >
                    <div style={thumbStyle} />
                </div>
                {label && (
                    <span style={labelStyle}>
                        {label}
                    </span>
                )}
            </div>
        )
    }
}

export default Switch
