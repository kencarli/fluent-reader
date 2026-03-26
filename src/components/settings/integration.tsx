import * as React from "react"
import intl from "react-intl-universal"
import { IntegrationSettings } from "../../schema-types"
import AIServicesInline from "./ai-services-inline"
import PushServicesInline from "./push-services-inline"
import TranslationServicesInline from "./translation-services-inline"
import CloudNoteServicesInline from "./cloud-note-services-inline"
import DailyBriefingInline from "./daily-briefing-inline"
import ArticleRatingInline from "./article-rating-inline"

type IntegrationTabState = {
    settings: IntegrationSettings,
    sources: any,
    groups: any[],
}

class IntegrationTab extends React.Component<{}, IntegrationTabState> {
    constructor(props) {
        super(props)
        const storeState = (window as any).__STORE__?.getState()
        this.state = {
            settings: window.settings.getIntegrationSettings() || {},
            sources: storeState?.sources || {},
            groups: storeState?.groups || [],
        }
    }

    handleAIServicesChange = (newSettings: IntegrationSettings) => {
        this.setState({ settings: newSettings })
        window.settings.setIntegrationSettings(newSettings)
    }

    handlePushServicesChange = (newSettings: IntegrationSettings) => {
        this.setState({ settings: newSettings })
        window.settings.setIntegrationSettings(newSettings)
    }

    handleTranslationServicesChange = (newSettings: IntegrationSettings) => {
        this.setState({ settings: newSettings })
        window.settings.setIntegrationSettings(newSettings)
    }

    handleCloudNoteServicesChange = (newSettings: IntegrationSettings) => {
        this.setState({ settings: newSettings })
        window.settings.setIntegrationSettings(newSettings)
    }

    handleDailyBriefingChange = (newSettings: IntegrationSettings) => {
        this.setState({ settings: newSettings })
        window.settings.setIntegrationSettings(newSettings)
    }

    handleArticleRatingChange = (newSettings: IntegrationSettings) => {
        this.setState({ settings: newSettings })
        window.settings.setIntegrationSettings(newSettings)
    }

    render() {
        const { settings, sources, groups } = this.state

        return (
            <div className="tab-body">
                <AIServicesInline
                    settings={settings}
                    onChange={this.handleAIServicesChange}
                />

                <div style={{ height: 24 }}></div>

                <PushServicesInline
                    settings={settings}
                    onChange={this.handlePushServicesChange}
                />

                <div style={{ height: 24 }}></div>

                <TranslationServicesInline
                    settings={settings}
                    onChange={this.handleTranslationServicesChange}
                />

                <div style={{ height: 24 }}></div>

                <CloudNoteServicesInline
                    settings={settings}
                    onChange={this.handleCloudNoteServicesChange}
                />

                <div style={{ height: 24 }}></div>

                <DailyBriefingInline
                    settings={settings}
                    sources={sources}
                    groups={groups}
                    onChange={this.handleDailyBriefingChange}
                />

                <div style={{ height: 24 }}></div>

                <ArticleRatingInline
                    settings={settings}
                    onChange={this.handleArticleRatingChange}
                />
            </div>
        )
    }
}

export default IntegrationTab
