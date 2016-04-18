#!/bin/bash

cd client
ember build --environment=production --output-path=../server/public/
cd ..
