const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const reimburseRoutes = require('./routes/reimburseRoutes');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', authRoutes);
app.use('/', reimburseRoutes);

app.listen(port, () => {
  console.log(`Server backend berjalan pada port ${port}`);
});