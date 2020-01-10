# My Note

## Create private key and certification

```bash
cd ./ssl_certs
openssl req -nodes -newkey rsa:2048 -keyout server.key -out server.csr -subj "/C=GB/ST=London/L=London/O=Global Security/OU=IT Department/CN=example.com"
openssl x509 -days 3650 -req -signkey server.key < server.csr > server.crt
```

## Run HTTP and HTTPS server

```bash
cd <this repo>
npm i
npm start -- --enable-https=true --https-port=4443 --key-path=./ssl_certs/server.key --crt-path=./ssl_certs/server.crt
```
