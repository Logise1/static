// Name: Multiplayer Rooms (Relay)
// ID: relayRooms
// Description: Create and join online rooms for your multiplayer games using a real-time Relay server.
// By: Logise
// License: MIT

(function (Scratch) {
  "use strict";

  // Global multiplayer state control
  let socket = null;
  let roomCode = "";
  let myUsername = "";
  let isHostUser = false;
  let maxPlayersLimit = 4;
  let enableTeams = false;
  let gameStartedState = false;
  let playerList = []; // Array of { username, ready, team }
  let lastReceivedMessage = "";
  let lastMessageSender = "";
  let currentError = "";
  let myCurrentTeam = "No Team";
  let myReadyState = false;
  let hostHandshakeTimeout = null;
  let hostUsername = "";

  // Helper to reset the entire network and room state
  function resetNetworkState() {
    if (socket) {
      try {
        socket.close();
      } catch (e) {}
    }
    socket = null;
    roomCode = "";
    myUsername = "";
    isHostUser = false;
    maxPlayersLimit = 4;
    enableTeams = false;
    gameStartedState = false;
    playerList = [];
    lastReceivedMessage = "";
    lastMessageSender = "";
    currentError = "";
    myCurrentTeam = "No Team";
    myReadyState = false;
    hostUsername = "";
    if (hostHandshakeTimeout) {
      clearTimeout(hostHandshakeTimeout);
      hostHandshakeTimeout = null;
    }
  }

  // Main Extension Class
  class MultiplayerRooms {
    constructor() {}

    getInfo() {
      return {
        id: "relayRooms",
        name: "Online Rooms",
        color1: "#3b82f6", // Modern blue
        color2: "#2563eb",
        blocks: [
          // Connection & Room Management Blocks
          {
            opcode: "hostRoom",
            blockType: Scratch.BlockType.COMMAND,
            text: "Host room [ROOM] as [USER] with max. players [MAX] Teams? [TEAMS]",
            arguments: {
              ROOM: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "room123",
              },
              USER: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "HostPlayer",
              },
              MAX: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 4,
              },
              TEAMS: {
                type: Scratch.ArgumentType.STRING,
                menu: "yesNoMenu",
                defaultValue: "No",
              },
            },
          },
          {
            opcode: "joinRoom",
            blockType: Scratch.BlockType.COMMAND,
            text: "Join room [ROOM] as Player [USER]",
            arguments: {
              ROOM: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "room123",
              },
              USER: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: "Player2",
              },
            },
          },
          {
            opcode: "leaveRoom",
            blockType: Scratch.BlockType.COMMAND,
            text: "Leave current room",
          },

          "---", // Visual divider

          // Lobby & Readiness Management
          {
            opcode: "setReadyState",
            blockType: Scratch.BlockType.COMMAND,
            text: "Set ready state to [READY]",
            arguments: {
              READY: {
                type: Scratch.ArgumentType.STRING,
                menu: "yesNoMenu",
                defaultValue: "Yes",
              },
            },
          },
          {
            opcode: "selectTeam",
            blockType: Scratch.BlockType.COMMAND,
            text: "Join team [TEAM]",
            arguments: {
              TEAM: {
                type: Scratch.ArgumentType.STRING,
                menu: "teamsMenu",
                defaultValue: "Red",
              },
            },
          },
          {
            opcode: "startGame",
            blockType: Scratch.BlockType.COMMAND,
            text: "Start game (Host only)",
          },

          "---",

          // Game Data Transmission
          {
            opcode: "sendMessage",
            blockType: Scratch.BlockType.COMMAND,
            text: "Send game message [MSG]",
            arguments: {
              MSG: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: '{"x": 100, "y": 250}',
              },
            },
          },
          {
            opcode: "getLastMessage",
            blockType: Scratch.BlockType.REPORTER,
            text: "Last message received",
          },
          {
            opcode: "getLastSender",
            blockType: Scratch.BlockType.REPORTER,
            text: "Sender of last message",
          },

          "---",

          // State Reporters
          {
            opcode: "isConnected",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "Connected to room?",
          },
          {
            opcode: "isHost",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "Is host?",
          },
          {
            opcode: "isGameStarted",
            blockType: Scratch.BlockType.BOOLEAN,
            text: "Is game started?",
          },
          {
            opcode: "getMyTeam",
            blockType: Scratch.BlockType.REPORTER,
            text: "My current team",
          },
          {
            opcode: "getPlayersCount",
            blockType: Scratch.BlockType.REPORTER,
            text: "Player count",
          },
          {
            opcode: "getPlayersList",
            blockType: Scratch.BlockType.REPORTER,
            text: "Player list (JSON)",
          },
          {
            opcode: "getRoomError",
            blockType: Scratch.BlockType.REPORTER,
            text: "Last room error",
          },

          "---",

          // Event / Hat Blocks
          {
            opcode: "onMessageReceived",
            blockType: Scratch.BlockType.HAT,
            text: "When game message received",
            isEdgeActivated: false,
          },
          {
            opcode: "onPlayerJoined",
            blockType: Scratch.BlockType.HAT,
            text: "When a player joins room",
            isEdgeActivated: false,
          },
          {
            opcode: "onGameStarted",
            blockType: Scratch.BlockType.HAT,
            text: "When the game starts",
            isEdgeActivated: false,
          },
        ],
        menus: {
          yesNoMenu: {
            acceptReporters: false,
            items: ["Yes", "No"],
          },
          teamsMenu: {
            acceptReporters: true,
            items: ["Red", "Blue", "No Team"],
          },
        },
      };
    }

    // --- CONNECTION CONTROL BLOCKS ---

    hostRoom(args) {
      resetNetworkState();

      const room = Scratch.Cast.toString(args.ROOM).trim();
      const user = Scratch.Cast.toString(args.USER).trim();
      const maxPlayers = Math.max(2, Scratch.Cast.toNumber(args.MAX));
      const useTeams = Scratch.Cast.toString(args.TEAMS) === "Yes";

      if (!room || !user) {
        currentError = "Invalid room name or username.";
        return;
      }

      roomCode = room;
      myUsername = user;
      isHostUser = true;
      maxPlayersLimit = maxPlayers;
      enableTeams = useTeams;
      hostUsername = user;
      myReadyState = true; // Host is always ready by default

      // Host adds themselves as the first player in the list
      playerList = [
        {
          username: user,
          ready: true,
          team: useTeams ? "Red" : "No Team",
        },
      ];
      myCurrentTeam = useTeams ? "Red" : "No Team";

      const url = `wss://logiseonlineservices.arielcapdevila.com/${room}/${user}`;
      this._connectWebSocket(url);
    }

    joinRoom(args) {
      resetNetworkState();

      const room = Scratch.Cast.toString(args.ROOM).trim();
      const user = Scratch.Cast.toString(args.USER).trim();

      if (!room || !user) {
        currentError = "Invalid room name or username.";
        return;
      }

      roomCode = room;
      myUsername = user;
      isHostUser = false;
      myReadyState = false;

      const url = `wss://logiseonlineservices.arielcapdevila.com/${room}/${user}`;
      this._connectWebSocket(url);
    }

    leaveRoom() {
      resetNetworkState();
    }

    // --- LOBBY / PREPARATION BLOCKS ---

    setReadyState(args) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (isHostUser) return; // Host is always ready

      const isReady = Scratch.Cast.toString(args.READY) === "Yes";
      myReadyState = isReady;

      // Notify the host about the readiness state update
      this._sendProtocolMessage({
        action: "update_player_state",
        username: myUsername,
        ready: isReady,
        team: myCurrentTeam,
      });
    }

    selectTeam(args) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (!enableTeams) return; // Do nothing if teams are disabled for this room

      const selectedTeam = Scratch.Cast.toString(args.TEAM);
      myCurrentTeam = selectedTeam;

      if (isHostUser) {
        // Host directly updates their own team and broadcasts it
        const me = playerList.find((p) => p.username === myUsername);
        if (me) {
          me.team = selectedTeam;
          this._hostBroadcastState();
        }
      } else {
        // Clients request a team change from the host
        this._sendProtocolMessage({
          action: "update_player_state",
          username: myUsername,
          ready: myReadyState,
          team: selectedTeam,
        });
      }
    }

    startGame() {
      if (!isHostUser || !socket || socket.readyState !== WebSocket.OPEN) return;

      // Ensure all other players in the room are ready
      const playersNotReady = playerList.filter(
        (p) => p.username !== myUsername && !p.ready
      );

      if (playersNotReady.length > 0) {
        currentError = "Cannot start. There are players who are not ready.";
        return;
      }

      gameStartedState = true;
      
      // Send the start command to everyone in the room
      this._sendProtocolMessage({
        action: "start_game_signal",
      });

      this._triggerHat("onGameStarted");
    }

    // --- GAME DATA MESSAGING BLOCKS ---

    sendMessage(args) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const msg = Scratch.Cast.toString(args.MSG);

      // Wrap game data inside our structured protocol envelope so clients
      // don't confuse it with lobby synchronization data
      this._sendProtocolMessage({
        action: "game_payload",
        sender: myUsername,
        payload: msg,
      });
    }

    getLastMessage() {
      return lastReceivedMessage;
    }

    getLastSender() {
      return lastMessageSender;
    }

    // --- STATE REPORTERS ---

    isConnected() {
      return socket !== null && socket.readyState === WebSocket.OPEN;
    }

    isHost() {
      return isHostUser;
    }

    isGameStarted() {
      return gameStartedState;
    }

    getMyTeam() {
      return myCurrentTeam;
    }

    getPlayersCount() {
      return playerList.length;
    }

    getPlayersList() {
      return JSON.stringify(playerList);
    }

    getRoomError() {
      return currentError;
    }

    // --- INTERNAL NETWORKING METHODS (WEBSOCKET & PROTOCOL) ---

    _connectWebSocket(url) {
      try {
        socket = new WebSocket(url);

        socket.onopen = () => {
          currentError = "";
          
          if (!isHostUser) {
            // Client handshake timeout:
            // If the host does not accept the join request within 4 seconds, abort.
            hostHandshakeTimeout = setTimeout(() => {
              currentError = "The room is invalid or the host is inactive.";
              resetNetworkState();
            }, 4000);

            // Send formal room entrance request to the host
            this._sendProtocolMessage({
              action: "request_join",
              username: myUsername,
            });
          }
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "system") {
              this._handleSystemEvent(data);
            } else if (data.type === "chat") {
              this._handleChatEvent(data);
            }
          } catch (e) {
            // Non-JSON message: ignored or debugged as raw text
          }
        };

        socket.onclose = () => {
          resetNetworkState();
        };

        socket.onerror = (err) => {
          currentError = "Error connecting to the server.";
          resetNetworkState();
        };
      } catch (e) {
        currentError = "Could not establish a network connection.";
      }
    }

    // Handle join/leave events triggered natively by the Relay backend
    _handleSystemEvent(data) {
      if (data.action === "join") {
        // If we are the Host, we detect and process the newly joined WebSocket
        if (isHostUser) {
          this._triggerHat("onPlayerJoined");
        }
      } else if (data.action === "leave") {
        const leftUser = data.username;
        
        // If the host leaves, the entire room is dismissed
        if (leftUser === hostUsername) {
          currentError = "The host has closed the room.";
          resetNetworkState();
          return;
        }

        // If host, remove the disconnected player from the master list and notify others
        if (isHostUser) {
          playerList = playerList.filter((p) => p.username !== leftUser);
          this._hostBroadcastState();
        }
      }
    }

    // Process messages forwarded by the Relay server
    _handleChatEvent(data) {
      try {
        // Attempt to decode our structured client-to-client protocol
        const protocolMsg = JSON.parse(data.message);
        
        if (protocolMsg && protocolMsg.action) {
          this._processProtocolAction(data.username, protocolMsg);
        }
      } catch (e) {
        // If a message is plain text or fallback JSON, treat it as general gameplay data
        this._registerGameMessage(data.username, data.message);
      }
    }

    // Multiplayer state machine built on top of the Relay server
    _processProtocolAction(sender, msg) {
      switch (msg.action) {
        case "request_join":
          if (isHostUser) {
            // Validation steps performed by the Host
            if (gameStartedState) {
              this._sendDirectProtocolMessage(sender, {
                action: "join_rejected",
                reason: "game_started",
              });
              return;
            }

            if (playerList.length >= maxPlayersLimit) {
              this._sendDirectProtocolMessage(sender, {
                action: "join_rejected",
                reason: "room_full",
              });
              return;
            }

            // Accept player
            const defaultTeam = enableTeams ? "Red" : "No Team";
            playerList.push({
              username: sender,
              ready: false,
              team: defaultTeam,
            });

            // Send explicit approval packet to the connecting user
            this._sendDirectProtocolMessage(sender, {
              action: "join_approved",
              host: myUsername,
              maxPlayers: maxPlayersLimit,
              useTeams: enableTeams,
              players: playerList,
            });

            // Distribute updated lobby room details to all connected clients
            this._hostBroadcastState();
            this._triggerHat("onPlayerJoined");
          }
          break;

        case "join_approved":
          if (!isHostUser && msg.username === myUsername) {
            // Dismiss handshake backup timeout
            if (hostHandshakeTimeout) {
              clearTimeout(hostHandshakeTimeout);
              hostHandshakeTimeout = null;
            }
            // Sync host-validated settings
            hostUsername = msg.host;
            maxPlayersLimit = msg.maxPlayers;
            enableTeams = msg.useTeams;
            playerList = msg.players;
            
            if (enableTeams) {
              myCurrentTeam = "Red"; // Assigned starting team
            }
          }
          break;

        case "join_rejected":
          if (!isHostUser && msg.username === myUsername) {
            if (hostHandshakeTimeout) {
              clearTimeout(hostHandshakeTimeout);
            }
            if (msg.reason === "room_full") {
              currentError = "The room is full.";
            } else if (msg.reason === "game_started") {
              currentError = "The game has already started in this room.";
            } else {
              currentError = "You were not allowed to join the room.";
            }
            resetNetworkState();
          }
          break;

        case "update_player_state":
          if (isHostUser) {
            // Host receives player updates, applies them locally and syncs them to everyone
            const pIndex = playerList.findIndex((p) => p.username === sender);
            if (pIndex !== -1) {
              playerList[pIndex].ready = msg.ready;
              playerList[pIndex].team = msg.team;
              this._hostBroadcastState();
            }
          }
          break;

        case "sync_lobby_state":
          if (!isHostUser) {
            // Clients receive the official player inventory state from the host
            playerList = msg.players;
          }
          break;

        case "start_game_signal":
          if (!isHostUser) {
            if (hostHandshakeTimeout) clearTimeout(hostHandshakeTimeout);
            gameStartedState = true;
            this._triggerHat("onGameStarted");
          }
          break;

        case "game_payload":
          // Filter out our own message echoes reflecting from the Relay server
          if (sender !== myUsername) {
            this._registerGameMessage(sender, msg.payload);
          }
          break;
      }
    }

    // Register valid gameplay payload data
    _registerGameMessage(sender, payload) {
      lastReceivedMessage = payload;
      lastMessageSender = sender;
      this._triggerHat("onMessageReceived");
    }

    // --- HELPER WRAPPER METHODS ---

    // Send serialized JSON data packet
    _sendProtocolMessage(obj) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(obj));
      }
    }

    // Deliver a packet aimed at a specific username in the room
    _sendDirectProtocolMessage(targetUser, obj) {
      const finalMsg = Object.assign({}, obj, { username: targetUser });
      this._sendProtocolMessage(finalMsg);
    }

    // Host disseminates the current client roster status
    _hostBroadcastState() {
      if (!isHostUser) return;
      this._sendProtocolMessage({
        action: "sync_lobby_state",
        players: playerList,
      });
    }

    // Fire PenguinMod Hat events
    _triggerHat(opcode) {
      if (typeof Scratch !== "undefined" && Scratch.vm && Scratch.vm.runtime) {
        Scratch.vm.runtime.startHats(`relayRooms_${opcode}`);
      }
    }
  }

  // Register the extension with PenguinMod
  Scratch.extensions.register(new MultiplayerRooms());
})(Scratch);
