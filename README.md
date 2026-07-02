# FishGameRegulatedRiver

<p align="left">
  <a href="/github/actions/workflow/status/:user/:repo/:workflow"><img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/martinoJC/FishGameRegulatedRiver/.github%2Fworkflows%2Fdocker-image.yml" /></a>
</p>

Making a fish game to navigate through a regulated river 

## Running it locally

Run the following to clone this repository:
```
git clone git@github.com:martinoJC/FishGameRegulatedRiver.git
```

In your terminal, navigate into the directory on your local machine and run docker compose, which will build the application and start a local `node.js` server:
```
cd FishGameRegulatedRiver
docker compose
```

After a few seconds, your local server should be ready. In your browser, navigate to `localhost:3000`, which should start your game!

If you are done with the game and would like to stop the server, run the following:
```
docker compose down
```