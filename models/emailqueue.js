module.exports = (sequelize, DataTypes) => {
  const EmailQueue = sequelize.define('EmailQueue', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    to_email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    from_email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    template: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    template_data: {
      type: DataTypes.JSON,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'email_queue'
  });

  // Static methods
  EmailQueue.queueEmail = async function(data) {
    try {
      await EmailQueue.create({
        to_email: data.to_email,
        from_email: data.from_email,
        subject: data.subject,
        body: data.body,
        template: data.template || null,
        template_data: data.template_data || null
      });
      console.log(`Mock email queued to ${data.to_email}: ${data.subject}`);
    } catch (error) {
      console.error('Failed to queue email:', error);
    }
  };

  return EmailQueue;
};