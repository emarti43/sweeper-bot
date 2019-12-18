# discordBotJS
simple discord bot that is used to delete images. More info can be found on [the bot's website](http://sweeper-bot-client.herokuapp.com/)

## Usage
With the token provided and required node packages installed, just run:
```
node discordBot.js
```
## Debugging
Some useful debugging information is provided to track the deletion tasks when passing in a DEBUG flag:
```
DEBUG=log node discordBot.js
```
### notes
this bot has a feature that deletes images posted from a particular channel. these channels are stored via some local psql database. Please have the server up and running in order for this feature to work
