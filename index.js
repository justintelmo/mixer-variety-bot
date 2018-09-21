'use strict';

const express = require('express');
const Mixer = require('beam-client-node');

const config = require('config');
const port = config.get('port') || 80;
const scopes = config.get('scopes');

const portAddition = port !== 80 ? `:${port}` : '';
const redirectUri = `${config.get('baseUrl')}${portAddition}/callback`;
const app = express();

/**
 * @return {Mixer.Client}
 */
function createClient() 
{
    const client = new Mixer.Client(new Mixer.DefaultRequestRunner());

    client.use(new Mixer.OAuthProvider(client, {
        clientId: config.get('clientId'),
        secret: config.get('clientSecret')
    }));

    return client;
}

const client = createClient();
let currentChannel;
app.get('/', (request, reply) => {
    console.log(redirectUri);
    reply.redirect(client.getProvider().getRedirect(redirectUri, scopes));
})

app.get('/callback', (request, reply) => {
    const oauth = client.getProvider();
    oauth.attempt(redirectUri, request.query)
        .then(() => {
            return client.request('GET', 'users/current');
        })
        .then(res => {
            currentChannel = res.body.channel;
            return client.request('GET', 'types', {
                qs: {
                    order: 'viewersCurrent:DESC',
                    limit: 50
                }
            });
        }).then(res => {
            // Grab all games from response
            const games = res.body;

            // Cut off top 5 games
            for (let i = 0; i < 5; i++) {
                games.splice(i, 1);
            }

            // Grab random element from remaining 45 games
            const randomType = games[Math.floor(Math.random() * games.length)];
            return client.request('GET', 'channels', {
                qs:{
                    where: `typeId:eq:${randomType.id}`,
                    order: 'viewersCurrent:DESC',
                    limit: 50
                }
            });
        })
        .then(res => {
            const channelsStreamingRandomGame = res.body;

            const randomChannelStreamingRandomGame = channelsStreamingRandomGame[Math.floor(Math.random() * channelsStreamingRandomGame.length)];

            client.request('PUT', `channels/${currentChannel.id}/hostee`, {body: {id: randomChannelStreamingRandomGame.id}})
                .then(res => {
                    reply.json(oauth.getTokens());
                }).catch(err => reply.json(err));
        }).catch(err => reply.json(err));            
});

app.listen(port, () => {
    console.log(`Listening on ${port}`);
});