import { Schema, model, Document, Types } from 'mongoose';
import { Instrument, Role } from '../types';

export interface IUserDocument extends Document {
  _id: Types.ObjectId;
  username: string;
  passwordHash: string;
  instrument: Instrument;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

const INSTRUMENTS: Instrument[] = [
  'drums',
  'guitar',
  'bass',
  'saxophone',
  'keyboards',
  'vocals',
];

const userSchema = new Schema<IUserDocument>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
    },
    passwordHash: {
      type: String,
      required: true,
      select: true,
    },
    instrument: {
      type: String,
      enum: INSTRUMENTS,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
    },
  },
  { timestamps: true }
);

const User = model<IUserDocument>('User', userSchema);

export default User;
