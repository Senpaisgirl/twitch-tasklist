import React, { useState, useEffect, useRef } from "react";
import tmi from "tmi.js";
import { fetchAccessToken } from "../../utils/auth";
import "./TaskList.css";

export default function TaskList() {
    const [tasks, setTasks] = useState({});
    const twitchClientRef = useRef(null);

    //Load tasks from localStorage on component mount
    useEffect(() => {
        const storedTasks = localStorage.getItem("twitchtasks");
        if (storedTasks) {
            try {
                const parsedTasks = JSON.parse(storedTasks);
                setTasks(parsedTasks);
            } catch (error) {
                console.error("Failed to parse tasks from localStorage:", error);
            }
        }
    }, []);

    //Save tasks to localStorage whenever tasks state changes
    useEffect(() => {
        if (Object.keys(tasks).length === 0) {
            localStorage.removeItem("twitchtasks");
        } else {
            localStorage.setItem("twitchtasks", JSON.stringify(tasks));
        }
    }, [tasks]);

    useEffect(() => {
        // if (!twitchClientRef.current) {
        //     twitchClientRef.current = new tmi.Client({
        //         options: { debug: true },
        //         identity: {
        //             username: "penpais_beaple",

        //             password: `oauth:${token}`,
        //         },
        //         channels: ["senpaisgirl"],
        //     });
        // }

        async function initClient() {
            const token = await fetchAccessToken();
            if (!token) {
                console.error("Failed to fetch access token");
                return;
            }

            twitchClientRef.current = new tmi.Client({
                options: { debug: true },
                identity: {
                    username: "penpais_beaple",
                    password: `oauth:${token}`,
                },
                channels: ["senpaisgirl"],
            });

            twitchClientRef.current.on("message", (channel, tags, message) => {
                const displayName = tags["display-name"] || tags.username;
                const usernameKey = tags.username?.toLowerCase();
                if (!usernameKey || !message) return;

                const isModOrStreamer =
                    tags.mod ||
                    usernameKey === "senpaisgirl" ||
                    tags.badges?.broadcaster === "1";

                const parts = message.trim().split(" ");
                const cmd = parts[0].toLowerCase();

                if (cmd === "!task") {
                    const taskText = parts.slice(1).join(" ");
                    if (!taskText) return;
                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey] || { displayName, tasks: [] };
                        const updatedTasks = [...userData.tasks, { text: taskText, done: false }];
                        return {
                            ...prevTasks,
                            [usernameKey]: { displayName: userData.displayName, tasks: updatedTasks }
                        };
                    });
                }

                if (cmd === "!deletetask") {
                    const index = parseInt(parts[1]) - 1;
                    if (isNaN(index)) return;
                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;
                        const userTasks = [...userData.tasks];
                        if (index < 0 || index >= userTasks.length) return prevTasks;
                        userTasks.splice(index, 1);
                        return {
                            ...prevTasks,
                            [usernameKey]: {
                                ...userData,
                                tasks: userTasks
                            }
                        };
                    });
                }

                if (cmd === "!done") {
                    const index = parseInt(parts[1]) - 1;
                    if (isNaN(index)) return;
                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;
                        const userTasks = [...userData.tasks];
                        if (index < 0 || index >= userTasks.length) return prevTasks;
                        userTasks[index] = { ...userTasks[index], done: true };
                        return {
                            ...prevTasks,
                            [usernameKey]: {
                                ...userData,
                                tasks: userTasks
                            }
                        };
                    });
                }

                if (cmd === "!undone") {
                    const index = parseInt(parts[1]) - 1;
                    if (isNaN(index)) return;
                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;
                        const userTasks = [...userData.tasks];
                        if (index < 0 || index >= userTasks.length) return prevTasks;
                        userTasks[index] = { ...userTasks[index], done: false };
                        return {
                            ...prevTasks,
                            [usernameKey]: {
                                ...userData,
                                tasks: userTasks
                            }
                        };
                    });
                }

                if (cmd === "!clear") {
                    setTasks((prevTasks) => {
                        const newTasks = { ...prevTasks };
                        delete newTasks[usernameKey];
                        return newTasks;
                    });
                }

                if (cmd === "!clearall" && isModOrStreamer) {
                    setTasks({});
                }
                
                console.log(`Received command: ${cmd} from ${usernameKey}`);
                
                if (cmd === "!clearuser" && isModOrStreamer) {
                    let targetUser = parts[1]?.toLowerCase();
                    if (!targetUser) return;

                    // Remove leading '@' if present
                    if (targetUser.startsWith("@")) {
                        targetUser = targetUser.slice(1);
                    }

                    setTasks((prevTasks) => {
                        const newTasks = { ...prevTasks };
                        delete newTasks[targetUser];
                        return newTasks;
                    });
                }
            });

            if (twitchClientRef.current.readyState() !== "OPEN") {
            try {
                await twitchClientRef.current.connect();
            } catch (error) {
                console.error("Failed to connect Twitch client:", error);
            }
        }
        }

        initClient();

        return () => {
            async function cleanup() {
            if (twitchClientRef.current) {
                // Fix: disconnect only if connection is open
                if (twitchClientRef.current.readyState() === "OPEN") {
                    try {
                        await twitchClientRef.current.disconnect();
                    } catch (err) {
                        // ignore error if disconnect fails
                        console.warn("Error disconnecting Twitch client:", err);
                    }
                }
                twitchClientRef.current.removeAllListeners();
                twitchClientRef.current = null;
            }
        }
        cleanup();
        };
    }, []);

    return (
        <div className="tasklist-container">
            <h3 className="tasklist-title">Task List</h3>
            {Object.keys(tasks).length === 0 ? (
                <p className="tasklist-empty">No tasks yet!</p>
            ) : (
                Object.entries(tasks).map(([userKey, userData]) => (
                    <div key={userKey} className="tasklist-user">
                        <strong className="tasklist-username">{userData.displayName}</strong>
                        <ul className="tasklist-items">
                            {userData.tasks.map((task, i) => (
                                <li
                                    key={i}
                                    className={`tasklist-item ${task.done ? "done" : ""}`}
                                >
                                    {i + 1}. {task.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            )}
        </div>
    );
}