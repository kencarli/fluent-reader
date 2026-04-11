import * as React from "react"
import intl from "react-intl-universal"
import { Spinner, SpinnerSize } from "@fluentui/react/lib/Spinner"
import { Label } from "@fluentui/react/lib/Label"

type DigestProgressProps = {
    isGenerating: boolean
    message?: string
}

export default class DigestProgress extends React.Component<DigestProgressProps> {
    render() {
        const { isGenerating, message = intl.get("digest.generating") } = this.props

        if (!isGenerating) {
            return null
        }

        return (
            <div
                className="digest-progress"
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: 'var(--neutralPrimary)',
                    color: 'var(--white)',
                    padding: '16px 24px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    zIndex: 1000,
                    minWidth: '250px'
                }}
            >
                <Spinner size={SpinnerSize.small} />
                <div style={{ flex: 1 }}>
                    <Label style={{ 
                        fontSize: '14px', 
                        fontWeight: 600,
                        margin: 0,
                        color: 'var(--white)'
                    }}>
                        {message}
                    </Label>
                    <div style={{
                        fontSize: '12px',
                        opacity: 0.7,
                        marginTop: '4px'
                    }}>
                        {intl.get("digest.takesTime")}
                    </div>
                </div>
            </div>
        )
    }
}
