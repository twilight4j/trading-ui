#!/bin/bash

git pull origin main

docker compose up -d --build

docker image prune -f