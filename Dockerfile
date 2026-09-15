FROM node:20-alpine

WORKDIR /app

# ডিপেনডেন্সি ইন্সটল
COPY package*.json ./
RUN npm install

# প্রজেক্টের সব কোড কপি (api ফোল্ডার সহ)
COPY . .

EXPOSE 8000

CMD ["node", "api/index.js"]
