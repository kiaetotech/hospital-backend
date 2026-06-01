const mongoose = require('mongoose');

const packageTestSchema = new mongoose.Schema({
  package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthPackage', required: true },
  test_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TestMaster', required: true }
});

module.exports = mongoose.model('PackageTest', packageTestSchema);