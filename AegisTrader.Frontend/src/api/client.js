import axios from 'axios';

const client = axios.create({
    baseURL: 'http://localhost:5273/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

export default client;