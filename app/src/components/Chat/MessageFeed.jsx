import React, { useEffect, useRef, Component } from "react"
import MessageContainer from "./MessageContainer"
import SendMessageContainer from "./SendMessageContainer"
import { SocketContext } from "/src/context/SocketContext"
import {
	uniqueNamesGenerator,
	adjectives,
	animals,
} from "unique-names-generator"
import { connect } from "react-redux"

// import { useDispatch } from "react-redux"
import { anonUser } from "../../reducers/anonUser"
import debounce from "lodash.debounce"

const baseURL = "http://localhost:8000"

class MessageFeed extends Component {
	static contextType = SocketContext

	constructor(props) {
		super(props)
		this.state = {
			messages: [], // Initialize data as an empty array
			randomName: "",
		}
		this.messagesEndRef = React.createRef()
		this.messageFeedRef = React.createRef()
		this.firstMessageRef = React.createRef()
		this.observer = null
	}

	componentDidMount() {
		const { socket } = this.context

		const randomNameConfig = {
			dictionaries: [adjectives, animals],
			separator: " ",
			seed: 123,
			style: "capital",
		}

		this.fetchMessages()

		socket.on("message", newMessage => {
			const userSeed = newMessage.userSeed

			randomNameConfig.seed = userSeed || 123
			const randomName = uniqueNamesGenerator(randomNameConfig)

			newMessage = newMessage.content
			if (!newMessage.user) {
				newMessage.user = { name: randomName, _id: 0 }
			}
			this.setState(
				prevState => ({
					messages: [...prevState.messages, newMessage],
				}),
				this.scrollToBottom
			)
		})
	}

	debouncedFetchMessages = debounce(this.fetchMessages, 500)

	handleFetchMessages(lastId) {
		console.log(lastId)
		this.debouncedFetchMessages(lastId)
	}

	fetchMessages(lastId = "") {
		console.log(lastId == "")
		fetch(baseURL + window.location.pathname + "/" + lastId)
			.then(response => {
				if (!response.ok) {
					throw new Error("Network response was not ok")
				}
				return response.json()
			})
			.then(messages => {
				if (lastId != "") {
					const allMessages = messages.concat(this.state.messages)
					this.setState({ messages: allMessages })
				} else {
					this.setState({ messages })
					this.scrollToBottom(true)
				}
				this.initializeObserver()
				console.log(this.state.messages)
			})
			.catch(error => {
				console.error("Error fetching data:", error)
			})
	}

	scrollToBottom = alwaysScroll => {
		const feed = this.messageFeedRef.current
		let scrolledFromBottom =
			feed.scrollHeight - feed.clientHeight - feed.scrollTop
		console.log(scrolledFromBottom)

		if (scrolledFromBottom < 200 || alwaysScroll) {
			console.log(this.messagesEndRef.current)
			this.messagesEndRef.current.scrollIntoView()
		}
	}

	componentWillUnmount() {
		const { socket } = this.context

		// Remove the socket event listener when the component unmounts
		socket.off("message")

		if (this.cleanupObserver) {
			this.cleanupObserver()
		}
	}

	componentDidUpdate() {
		if (this.firstMessageRef.current) {
			this.initializeObserver()
		} else {
			return
		}

		// Check if firstMessageRef has changed
		if (this.firstMessageRef.current) {
			if (this.firstMessageRef.current !== this.observer.target) {
				// Disconnect the existing observer
				if (this.observer) {
					this.observer.disconnect()
				}
			}
		}
	}

	initializeObserver() {
		this.observer = new IntersectionObserver(entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					this.handleFetchMessages(this.state.messages[0]._id)
					console.log(this.state.messages[0])
					console.log("Element is visible!")
					// Your action here
				}
			})
		})

		if (this.firstMessageRef.current) {
			this.observer.observe(this.firstMessageRef.current)
		}
	}

	render() {
		const { messages } = this.state

		return (
			<div className="w-full absolute inset-0 flex flex-col-reverse">
				<SendMessageContainer />
				<div ref={this.messageFeedRef} className="h-full overflow-y-scroll">
					{messages.map((message, index) => {
						const isFirstMessage = index === 0
						const isFollowUp =
							!isFirstMessage &&
							messages[index - 1]?.user_seed === message.user_seed
						const isFollowed =
							messages[index + 1]?.user_seed === message.user_seed

						return (
							<div
								key={index}
								ref={isFirstMessage ? this.firstMessageRef : null}
							>
								<MessageContainer
									message={message}
									followUp={isFollowUp}
									followed={isFollowed}
								/>
							</div>
						)
					})}{" "}
					<div ref={this.messagesEndRef} />
				</div>
			</div>
		)
	}
}

const mapStateToProps = state => ({
	anonUser: state,
})

const mapDispatchToProps = {
	updateName: anonUser.actions.updateName,
}

const ConnectedMessageFeed = connect(
	mapStateToProps,
	mapDispatchToProps
)(MessageFeed)

export default ConnectedMessageFeed
