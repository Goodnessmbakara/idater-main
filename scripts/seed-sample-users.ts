import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import userModel from "../src/models/user.model";
import fs from 'fs';
import bcrypt from "bcryptjs";
import mongoose from 'mongoose';
import { config } from '../src/config';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
});

async function uploadImage(file): Promise<string> {
    try {
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'idater',
            resource_type: 'auto',
        });

        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error('Failed to upload image');
    }
}

const generateRandomUser = () => {
    const firstNames = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Hannah', 'Isaac', 'Jack'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
    const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randomEmail = `${randomFirstName.toLowerCase()}.${randomLastName.toLowerCase()}${Math.floor(Math.random() * 100)}@example.com`;
    return {
        firstName: randomFirstName,
        lastName: randomLastName,
        email: randomEmail,
        dateOfBirth: new Date(new Date().setFullYear(new Date().getFullYear() - 38)),
        gender: 'woman',
        role: 'user',
        bio: '',
        about: '',
        interest: Math.random() < 0.5 ? 'dating' : 'hookup',
    };
};

async function connectToMongoDB() {
    try {
        console.log('Attempting to connect to MongoDB...');
        
        await mongoose.connect(config.database.uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            w: 'majority',
            maxPoolSize: 10,
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: true
        });
        
        console.log('Successfully connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
        throw error;
    }
}

async function seedUsers() {
    try {
        await connectToMongoDB();

        const imgDir = path.join(__dirname, 'img');
        const files = await fs.promises.readdir(imgDir);
        const images = files.filter(file => /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(file));
        
        console.log('Found images:', images);

        const randomUsers = await Promise.all(images.map(async (image) => {
            try {
                const filePath = path.join(imgDir, image);
                const fileBuffer = await fs.promises.readFile(filePath);
                const mimeType = `image/${path.extname(image).slice(1)}`;

                const fileObject = {
                    fieldname: 'profileImage',
                    originalname: image,
                    encoding: '7bit',
                    mimetype: mimeType,
                    buffer: fileBuffer,
                    size: fileBuffer.length,
                    destination: '',
                    filename: image,
                    path: filePath,
                };

                const uploadedImageUrl = await uploadImage(fileObject);
                const userData = generateRandomUser();

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('password', salt);

                const user = new userModel({
                    ...userData,
                    profileImage: uploadedImageUrl,
                    password: hashedPassword
                });

                await user.save();
                console.log(`Created user: ${userData.email}`);
                return user;

            } catch (error) {
                console.error(`Error processing image ${image}:`, error);
                return null;
            }
        }));

        const successfulUsers = randomUsers.filter(user => user !== null);
        console.log(`Successfully created ${successfulUsers.length} users`);
        
    } catch (error) {
        console.error('Seed script failed:', error);
    } finally {
        try {
            await mongoose.disconnect();
            console.log('Disconnected from MongoDB');
        } catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
        }
        process.exit(0);
    }
}

seedUsers().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
}); 