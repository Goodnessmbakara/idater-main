import axios from 'axios';
import { config } from '../config';

const CALL_ME_BOT_API_URL = 'https://api.callmebot.com/whatsapp.php';

function callmebotAlertAdmin(message: string): void {
  const text = encodeURIComponent('NEW MESSAGE FOR ADMIN --'+message);
  axios.get(`${CALL_ME_BOT_API_URL}?phone=${config.callMeBot.phone}&text=${text}&apikey=${config.callMeBot.apiKey}`)
    .then(response => {
      console.log('CallMeBot response', response.data);
    })
    
}



export { callmebotAlertAdmin };