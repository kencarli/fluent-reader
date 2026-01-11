import * as React from "react"
import intl from "react-intl-universal"
import { connect } from "react-redux"
import { RootState } from "../../scripts/reducer"
import { SearchBox, ISearchBox, Async } from "@fluentui/react"
import { AppDispatch, validateRegex } from "../../scripts/utils"
import { performSearch, toggleSemanticSearch } from "../../scripts/models/page"
import { FilterType } from "../../scripts/models/feed"
import { ActionButton, Icon } from "@fluentui/react"

type SearchProps = {
    searchOn: boolean
    semanticSearchOn: boolean
    initQuery: string
    dispatch: AppDispatch
}

type SearchState = {
    query: string
}

class ArticleSearch extends React.Component<SearchProps, SearchState> {
    debouncedSearch: (query: string) => void
    inputRef: React.RefObject<ISearchBox>

    constructor(props: SearchProps) {
        super(props)
        this.debouncedSearch = new Async().debounce((query: string) => {
            let regex = validateRegex(query)
            if (regex !== null) props.dispatch(performSearch(query))
        }, 750)
        this.inputRef = React.createRef<ISearchBox>()
        this.state = { query: props.initQuery }
    }

    onSearchChange = (_, newValue: string) => {
        this.debouncedSearch(newValue)
        this.setState({ query: newValue })
    }

    toggleSemantic = () => {
        this.props.dispatch(toggleSemanticSearch())
        // Re-trigger search with current query to switch modes
        this.props.dispatch(performSearch(this.state.query))
    }

    componentDidUpdate(prevProps: SearchProps) {
        if (this.props.searchOn && !prevProps.searchOn) {
            this.setState({ query: this.props.initQuery })
            this.inputRef.current.focus()
        }
    }

    render() {
        return (
            this.props.searchOn && (
                <div className="article-search-container" style={{ display: 'flex', alignItems: 'center' }}>
                    <SearchBox
                        componentRef={this.inputRef}
                        className="article-search"
                        placeholder={intl.get(this.props.semanticSearchOn ? "semantic_search" : "search")}
                        value={this.state.query}
                        onChange={this.onSearchChange}
                        style={{ flexGrow: 1 }}
                    />
                    <ActionButton
                        iconProps={{ iconName: this.props.semanticSearchOn ? "Brain" : "Search" }}
                        onClick={this.toggleSemantic}
                        title={intl.get(this.props.semanticSearchOn ? "disable_semantic" : "enable_semantic")}
                        style={{ height: 32, marginLeft: 4 }}
                    >
                        {this.props.semanticSearchOn && <span style={{ fontSize: 10, marginLeft: 4 }}>AI</span>}
                    </ActionButton>
                </div>
            )
        )
    }
}

const getSearchProps = (state: RootState) => ({
    searchOn: state.page.searchOn,
    semanticSearchOn: state.page.semanticSearchOn,
    initQuery: state.page.filter.search,
})
export default connect(getSearchProps)(ArticleSearch)
