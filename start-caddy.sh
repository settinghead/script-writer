#! /bin/bash

caddy reverse-proxy --from https://localhost:4610 --to http://localhost:4600 --disable-redirects
