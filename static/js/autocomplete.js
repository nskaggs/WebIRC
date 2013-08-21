function initAutoComplete() {
	var activeAutoComplete = null;

	return {
		next: function(chatboxValue, cursorPos, activeWindow) {
			if (activeAutoComplete === null) {
				// if no active autocomplete, let's create one

				// extract the prefix and its starting index
				var prefixResult = getAutoCompletePrefix(chatboxValue, cursorPos);

				if (prefixResult !== null) {
					var server = activeWindow.server;
					var autoCompleteSuggestions = null;

					if (activeWindow.type === 'channel') {
						var channel = activeWindow.object;

						autoCompleteSuggestions = getAutoCompleteSuggestionsForChannel(server, channel);
					} else {
						autoCompleteSuggestions = getGeneralAutoCompleteSuggestions(server);
					}

					if (autoCompleteSuggestions && autoCompleteSuggestions.length > 0) {
						activeAutoComplete = {
							originalChatboxValue: chatboxValue,
							prefix: prefixResult.prefix,
							prefixStartIndex: prefixResult.prefixStartIndex,
							suggestions: autoCompleteSuggestions,
							index: 0
						};
					}
				}
			}

			if (activeAutoComplete) {
				var startIndex = activeAutoComplete.index;

				var matchedNick = null;

				var rolledOver = false;

				while (true) {
					if (rolledOver && activeAutoComplete.index >= startIndex) {
						// gone through the entire list and found no matches
						break;
					} else {
						var nick = activeAutoComplete.suggestions[activeAutoComplete.index];
						if (nick.indexOf(activeAutoComplete.prefix) === 0) {
							matchedNick = nick;
						}
					}

					// increment in a circular fashion
					activeAutoComplete.index = (activeAutoComplete.index + 1) % activeAutoComplete.suggestions.length;

					// if it's 0 after incrementing, we rolled over
					if (activeAutoComplete.index == 0) {
						rolledOver = true;
					}

					// on match, we break out after the increment so that the index is that of the next element
					if (matchedNick) {
						break;
					}
				}

				if (matchedNick) {
					return applySuggestionToChatbox(matchedNick, activeAutoComplete);
				} else {
					return null;
				}
			} else {
				return null;
			}
		},
		reset: function() {
			activeAutoComplete = null;
		}
	};

	function getAutoCompletePrefix(s, pos) {
		var ret = null;

		// if we're at the end of a word
		if (pos == s.length || (pos < s.length && s[pos].match(/[\W]/))) {
			var strBeforePos = s.substring(0, pos);
			var lastWordStartIndex = strBeforePos.lastIndexOf(' ') + 1;
			var possiblePrefix = strBeforePos.substring(lastWordStartIndex);

			if (possiblePrefix.length > 0) {
				ret = {
					prefix: possiblePrefix,
					prefixStartIndex: lastWordStartIndex
				};
			}
		}

		return ret;
	}

	function getGeneralAutoCompleteSuggestions(server) {
		var suggestions = getNamesOfMyChannels(server).concat(getNamesOfMyQueries(server));

		return suggestions;
	}

	function getNamesOfMyChannels(server) {
		return server.channels.map(function(c) {
			return c.name;
		});
	}

	function getNamesOfMyQueries(server) {
		return server.queries.map(function(q) {
			return q.name;
		});
	}

	function getAutoCompleteSuggestionsForChannel(server, channel) {
		// current channel
		var suggestions = [channel.name];

		// concat the rest of the channels
		suggestions = suggestions.concat(getNamesOfMyChannels(server));

		// use the last 100 activities
		var recentActivities = channel.activityLog.slice(-100);

		// most recent first
		recentActivities.reverse();

		// get nicknames from activities (note the flattening of arrays)
		var nicksFromActivities = Array.prototype.concat.apply([], recentActivities.map(getNicknamesFromActivity));

		// append the nicks from activities and then the userlist
		suggestions = suggestions.concat(nicksFromActivities, channel.userlist.map(function(userlistEntry) {
			return userlistEntry.nick;
		}));

		// now we have the suggestions in the order we want

		// remove duplicates, preserving the order
		suggestions = arrayRemoveDuplicates(suggestions);

		return suggestions;

		function getNicknamesFromActivity(activity) {
			switch (activity.type) {
				case 'Action':
					return [activity.nick];
				case 'ChatMessage':
					return [activity.nick];
				case 'Join':
					return [activity.who.nick];
				case 'Kick':
					return [activity.targetNick, activity.originName];
				case 'KickMe':
					return [activity.originName];
				case 'ModeChange':
					// this could contain mode args that aren't nicks, but whatever for now
					return [activity.who.nick].concat(activity.modeArgs);
				case 'NickChange':
					return [activity.oldNickname, activity.newNickname];
				case 'Notice':
					return [activity.nick];
				case 'Part':
					return [activity.who.nick];
				case 'Quit':
					return [activity.who.nick];
				default:
					return [];
			}
		}
	}

	function applySuggestionToChatbox(suggestion, activeAutoComplete) {
		var beforePrefix = activeAutoComplete.originalChatboxValue.slice(0, activeAutoComplete.prefixStartIndex);
		var afterPrefix = activeAutoComplete.originalChatboxValue.slice(activeAutoComplete.prefixStartIndex + activeAutoComplete.prefix.length);

		return {
			chatboxValue: beforePrefix + suggestion + afterPrefix,
			cursorPos: activeAutoComplete.prefixStartIndex + suggestion.length
		};
	}
}
