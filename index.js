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
    var channelService = new Mixer.ChannelService(client);
    oauth.attempt(redirectUri, request.query)
        .then(() => {
            console.log("Successfully authenticated!");
            return client.request('GET', 'users/current');
        }).then(res => {
            currentChannel = res.body.channel;
            console.log("Grabbed current user!");
            return channelService.getChannel('ahhreggi');
        }).catch(err => reply.json(err))
        .then(res => {
            let hosteeChannelId = res.body.userId;
            console.log("attempting to host");
            console.log(currentChannel);
            client.request('PUT', `channels/${currentChannel.id}/hostee`, {body: {id: res.body.id}})
                .then(res => {
                    reply.json(oauth.getTokens());
                    console.log(res);  
                })
                .catch(err => {
                    console.log(err);
                });
        });            
});

app.listen(port, () => {
    console.log(`Listening on ${port}`);
});