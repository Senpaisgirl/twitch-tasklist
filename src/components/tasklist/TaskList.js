import React, { useState, useEffect, useRef } from "react";
import tmi from "tmi.js";
import { fetchAccessToken } from "../../utils/auth";
import "./TaskList.css";

export default function TaskList() {
    const [tasks, setTasks] = useState({});

    const twitchClientRef = useRef(null);

    // Refs for autoscroll
    const containerRef = useRef(null);
    const listRef = useRef(null);

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
        async function initClient() {
            const token = await fetchAccessToken();
            if (!token) {
                console.error("Failed to fetch access token");
                return;
            }
            console.log("Fetched Twitch OAuth token:", token);

            twitchClientRef.current = new tmi.Client({
                options: { debug: true },
                connection: {
                    reconnect: true,
                    secure: true,
                },
                identity: {
                    username: "penpais_beaple",
                    password: `oauth:${token}`,
                },
                channels: ["senpaisgirl"],
            });

            twitchClientRef.current.on("connected", (address, port) => {
                console.log(`Connected to Twitch chat at ${address}:${port}`);
            });

            twitchClientRef.current.on('disconnected', (reason) => {
                console.log(`Disconnected: ${reason}`);
            });

            twitchClientRef.current.on('reconnect', () => {
                console.log('Reconnecting...');
            });

            twitchClientRef.current.on('error', (err) => {
                console.error('Error:', err);
            });


            twitchClientRef.current.on("disconnected", (reason) => {
                console.warn(`Disconnected from Twitch chat: ${reason}`);
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

                        const newTaskEntries = taskText.split(";").map( text => ({
                            text: text.trim(),
                            done: false,
                            current: false,
                            repeating: false

                        })).filter(t => t.text.length > 0); //skip empty tasks

                        const hasCurrent = userData.tasks.some(t => t.current);
                        if (!hasCurrent) {
                            const firstNormal = newTaskEntries.find(t => !t.repeating);
                            if (firstNormal) {
                                userData.tasks.forEach( t => t.current = false); // reset current task
                                firstNormal.current = true;
                            }
                        }

                        return {
                            ...prevTasks,
                            [usernameKey]: { displayName: userData.displayName, tasks: [...userData.tasks, ...newTaskEntries] }
                        };
                    });
                }

                if (cmd === "!repeat") {
                    const taskText = parts.slice(1).join(" ");
                    if (!taskText) return;

                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey] || { displayName, tasks: [] };

                        const newTaskEntries = taskText.split(";").map(text => ({
                            text: text.trim(),
                            done: false,
                            current: false,
                            repeating: true
                        })).filter(t => t.text.length > 0); //skip empty tasks

                        const hasCurrent = userData.tasks.some(t => t.current);
                        if (!hasCurrent) {
                            const firstNormal = newTaskEntries.find(t => !t.repeating);
                            if (firstNormal) firstNormal.current = true;
                        }
                        return {
                            ...prevTasks,
                            [usernameKey]: { displayName: userData.displayName, tasks: [...userData.tasks, ...newTaskEntries] }
                        };
                    });
                }

                if (cmd === "!current") {
                    const index = parseInt(parts[1]) - 1;
                    if (isNaN(index)) return;

                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;

                        const userTasks = userData.tasks.map((task, i) => ({
                            ...task,
                            current: !task.repeating && i === index //only normal tasks can be current
                        }));

                        return {
                            ...prevTasks,
                            [usernameKey]: {
                                ...userData,
                                tasks: userTasks
                            }
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
                    const restOfMessage = parts.slice(1).join(" ");
                    const [done, newCurrentTask] = restOfMessage.split(";").map(t => t.trim());

                    const doneIndex = parseInt(parts[1]) - 1;
                    if (isNaN(doneIndex)) return;

                    let newCurrentIndex = null;
                    if (newCurrentTask !== undefined) {
                        const parsedNewCurrentIndex = parseInt(newCurrentTask) - 1;
                        if (!isNaN(parsedNewCurrentIndex)) {
                            newCurrentIndex = parsedNewCurrentIndex;
                        }
                    }

                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;
                        const userTasks = [...userData.tasks];

                        userTasks[doneIndex] = { ...userTasks[doneIndex], done: true };

                        //if new current task is specified, set it as current
                        if (newCurrentTask !== null && userTasks[newCurrentIndex]) {
                            userTasks[doneIndex].current = false; // reset
                            if (!userTasks[newCurrentIndex].repeating) {
                                userTasks[newCurrentIndex].current = true; // set new current task
                            }
                        } else {
                            //otherwise pick first non-repeating task as current
                            userTasks[doneIndex].current = false; //reset
                            const firstNotDone = userTasks.findIndex(t => !t.done && !t.repeating);
                            if (firstNotDone !== -1) userTasks[firstNotDone].current = true;
                        }

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

                        userTasks[index] = {...userTasks[index], current: false }; // reset current if undone

                        const hasCurrent = userTasks.some(t => t.current);
                        if (!hasCurrent) {
                            userTasks.forEach(t => t.current = false); // reset all current
                            userTasks[index].current = true; // set undone task as current
                        }

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

    // Autoscroll effect
    useEffect(() => {
        const container = containerRef.current;
        const list = listRef.current;
        if (!container || !list) return;

        let scrollPosition = 0;
        let scrollDirection = 1; // 1: down, -1: up
        const step = 1; // pixels per step
        const intervalTime = 20; // ms per step
        const pauseTime = 1500; // ms pause at top/bottom

        let scrollInterval;

        function autoscroll() {
            const maxScroll = list.scrollHeight - container.clientHeight;
            if (maxScroll <= 0) return; // no scrolling needed

            scrollPosition += step * scrollDirection;

            if (scrollPosition >= maxScroll) {
                scrollPosition = maxScroll;
                scrollDirection = -1;
                pauseScrolling();
            } else if (scrollPosition <= 0) {
                scrollPosition = 0;
                scrollDirection = 1;
                pauseScrolling();
            }

            list.style.transform = `translateY(${-scrollPosition}px)`;
        }

        function startScrolling() {
            clearInterval(scrollInterval);
            scrollInterval = setInterval(autoscroll, intervalTime);
        }

        function pauseScrolling() {
            clearInterval(scrollInterval);
            setTimeout(() => {
                startScrolling();
            }, pauseTime);
        }

        startScrolling();

        // Cleanup on unmount or tasks change
        return () => clearInterval(scrollInterval);

    }, [tasks]); // restart scroll when tasks change

    return (
        <div className="tasklist-container">
            <h3 className="tasklist-title">Task List</h3>
            {Object.keys(tasks).length === 0 ? (
                <p className="tasklist-empty">No tasks yet!</p>
            ) : (
                <div className="tasklist-wrapper" ref={containerRef}>
                    <div className="tasklist-scrollwrapper" ref={listRef}>
                        {
                        Object.entries(tasks).map(([userKey, userData]) => (
                            <div key={userKey} className="tasklist-user">
                                <strong className="tasklist-username">{userData.displayName}</strong>
                                <ul className="tasklist-items">
                                {/* Repeating tasks first (no numbers) */}
                                    {userData.tasks
                                        .filter(task => task.repeating)
                                        .map((task, i) => (
                                            <li 
                                                key={`repeat-${i}`} 
                                                className={`tasklist-item repeating ${task.done ? "done" : ""}`}
                                            >
                                                {task.text}
                                            </li>
                                        ))}

                                {/* Normal tasks with current highlighted */}
                                    {userData.tasks.filter(task => !task.repeating).map((task, i) => (
                                        <li
                                            key={i}
                                            className={`tasklist-item ${task.done ? "done" : ""} ${task.current ? "current" : ""}`}
                                        >
                                            {i + 1}. {task.text}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                        }
                    </div>
                </div>
            )}
        </div>
    );
}