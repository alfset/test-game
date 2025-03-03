// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GameFi {
    struct Player {
        uint256 score;
        int256 position;
    }

    mapping(address => Player) public players;
    event PlayerMoved(address indexed player, int256 newPosition);
    event ScoreCollected(address indexed player, uint256 newScore);
    event GameOver(address indexed player, uint256 finalScore);
    int256 constant MIN_POSITION = 0;
    int256 constant MAX_POSITION = 10;

    function movePlayer(string memory direction) external {
        Player storage player = players[msg.sender];

        bool isMoveSuccessful = false;

        if (keccak256(bytes(direction)) == keccak256(bytes("up"))) {
            if (player.position + 1 <= MAX_POSITION) {
                player.position += 1;
                isMoveSuccessful = true;
            }
        } else if (keccak256(bytes(direction)) == keccak256(bytes("down"))) {
            if (player.position - 1 >= MIN_POSITION) {
                player.position -= 1;
                isMoveSuccessful = true;
            }
        } else {
            revert("Invalid direction. Use 'up' or 'down'.");
        }

        if (isMoveSuccessful) {
            player.score += 1;
            emit PlayerMoved(msg.sender, player.position);
            emit ScoreCollected(msg.sender, player.score);
        }
    }

    function getPlayerPosition(address player) external view returns (int256) {
        return players[player].position;
    }

    function initializePlayerPosition() external {
        Player storage player = players[msg.sender];
        require(player.position == 0, "Position already initialized");
        player.position = 5;
    }

    function collectScore() external {
        Player storage player = players[msg.sender];
        emit ScoreCollected(msg.sender, player.score);
    }

    function getPlayerScore(address player) external view returns (uint256) {
        return players[player].score;
    }

    function gameOver() internal {
        Player storage player = players[msg.sender];
        emit GameOver(msg.sender, player.score);
        player.position = 5;
        player.score = 0;
    }
}
