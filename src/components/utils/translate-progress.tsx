import * as React from "react"
import { Icon } from "@fluentui/react/lib/Icon"

type TranslateProgressProps = {
    completed: number
    total: number
}

export default class TranslateProgress extends React.Component<TranslateProgressProps> {
    render() {
        const { completed, total } = this.props
        
        if (completed === 0 && total === 0) {
            return null
        }
        
        return (
            <div 
                className="translate-progress"
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: 'var(--neutralPrimary)',
                    color: 'var(--white)',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    zIndex: 1000,
                    minWidth: '200px'
                }}
            >
                <Icon 
                    iconName="Translate" 
                    style={{ 
                        fontSize: '20px',
                        color: '#4CAF50'
                    }} 
                />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                        Translating titles...
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                        {completed} / {total}
                    </div>
                </div>
                {completed === total && (
                    <Icon 
                        iconName="CheckMark" 
                        style={{ 
                            fontSize: '20px',
                            color: '#4CAF50'
                        }} 
                    />
                )}
            </div>
        )
    }
}
