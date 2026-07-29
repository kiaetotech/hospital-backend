const mongoose = require('mongoose');

const packageTestSchema = new mongoose.Schema({
  package_id: { type.Schema.Types.ObjectId, ref: 'HealthPackage', required},
  test_id: { type.Schema.Types.ObjectId, ref: 'TestMaster', required}
});

module.exports = mongoose.model('PackageTest', packageTestSchema);

