/**
 * Logger utility untuk production-ready logging
 * Console.error hanya akan muncul di development mode
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  error: (message, error) => {
    if (isDevelopment) {
      console.error(message, error);
    }
  },
  
  info: (message) => {
    if (isDevelopment) {
      console.log(message);
    }
  },

  warn: (message) => {
    if (isDevelopment) {
      console.warn(message);
    }
  }
};

module.exports = logger;
