import React, { useState, useEffect, useRef } from "react";
import tmi from "tmi.js";
import { fetchAccessToken } from "../../utils/auth";
import "./TaskList.css";

export default function TaskList() {
    const testTasks = {
        alice: {
            displayName: "Alice",
            tasks: [
            { text: "Finish report", done: false, current: true, repeating: false },
            { text: "Daily review", done: false, current: false, repeating: true }
            ]
        },
        bob: {
            displayName: "Bob",
            tasks: [
            { text: "Fix bug #42", done: true, current: false, repeating: false },
            { text: "Weekly sync", done: false, current: true, repeating: false }
            ]
        },
        charlie: {
            displayName: "Charlie",
            tasks: [
            { text: "Update website", done: false, current: true, repeating: false }
            ]
        },
        diana: {
            displayName: "Diana",
            tasks: [
            { text: "Create artwork", done: false, current: true, repeating: false },
            { text: "Backup files", done: false, current: false, repeating: true }
            ]
        },
        ethan: {
            displayName: "Ethan",
            tasks: [
            { text: "Test prototype", done: false, current: true, repeating: false }
            ]
        },
        fiona: {
            displayName: "Fiona",
            tasks: [
            { text: "Order supplies", done: true, current: false, repeating: false },
            { text: "Clean workspace", done: false, current: true, repeating: false }
            ]
        },
        george: {
            displayName: "George",
            tasks: [
            { text: "Review PR", done: false, current: true, repeating: false },
            { text: "Team meeting", done: false, current: false, repeating: true }
            ]
        }
    };


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
                    const visibleIndex = parseInt(parts[1]) - 1;
                    if (isNaN(visibleIndex)) return;

                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;

                        const userTasks = [...userData.tasks];

                        const nonRepeatingIndexes = userTasks
                        .map((t, i) => (!t.repeating ? i : null))
                        .filter(i => i !== null);

                        const actualIndex = nonRepeatingIndexes[visibleIndex];
                        if (actualIndex === undefined) return prevTasks;

                        const updatedTasks = userTasks.map((task, i) => ({
                        ...task,
                        current: i === actualIndex && !task.repeating,
                        }));

                        return {
                        ...prevTasks,
                        [usernameKey]: {
                            ...userData,
                            tasks: updatedTasks,
                        },
                        };
                    });
                }

                if (cmd === "!deletetask") {
                    const indicesStr = parts.slice(1).join(" ");
                    if (!indicesStr) return;

                    const visibleIndices = indicesStr
                        .split(";")
                        .map(t => parseInt(t.trim()) - 1)
                        .filter(i => !isNaN(i));
                    if (visibleIndices.length < 1) return;

                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;

                        const userTasks = [...userData.tasks];

                        // Normal tasks only (no repeating)
                        const normalTaskIndices = userTasks
                            .map((task, idx) => ({ task, index: idx }))
                            .filter(({ task }) => !task.repeating)
                            .map(({ index }) => index);

                        // Sort descending to delete from the end to avoid index shifting
                        visibleIndices.sort((a, b) => b - a);

                        visibleIndices.forEach((inputIndex) => {
                            if (inputIndex >= 0 && inputIndex < normalTaskIndices.length) {
                                const trueIndex = normalTaskIndices[inputIndex];
                                userTasks.splice(trueIndex, 1);
                            }
                        });

                        return {
                            ...prevTasks,
                            [usernameKey]: {
                                ...userData,
                                tasks: userTasks
                            }
                        };
                    });
                }

                if (cmd === "!deleterepeat") {
                    const indicesStr = parts.slice(1).join(" ");
                    if (!indicesStr) return;

                    const visibleIndices = indicesStr
                        .split(";")
                        .map(t => parseInt(t.trim()) - 1)
                        .filter(i => !isNaN(i));
                    if (visibleIndices.length < 1) return;

                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;

                        let userTasks = [...userData.tasks];

                        // Repeating tasks only
                        const repeatingTaskIndices = userTasks
                            .map((task, idx) => ({ task, index: idx }))
                            .filter(({ task }) => task.repeating)
                            .map(({ index }) => index);

                        // Sort descending for safe deletion
                        visibleIndices.sort((a, b) => b - a);

                        visibleIndices.forEach((inputIndex) => {
                            if (inputIndex >= 0 && inputIndex < repeatingTaskIndices.length) {
                                const trueIndex = repeatingTaskIndices[inputIndex];
                                userTasks.splice(trueIndex, 1);
                            }
                        });

                        return {
                            ...prevTasks,
                            [usernameKey]: {
                                ...userData,
                                tasks: userTasks,
                            },
                        };
                    });
                }

                if (cmd === "!done") {
                    const doneTasksStr = parts.slice(1).join(" ");
                    if (!doneTasksStr) return;

                    const doneVisibleIndex = doneTasksStr
                        .split(";")
                        .map(t => parseInt(t.trim()) - 1)
                        .filter(i => !isNaN(i));
                    if (doneVisibleIndex.length < 1) return;

                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;

                        const userTasks = [...userData.tasks];

                        // Map visible (non-repeating) index to actual index
                        const nonRepeatingIndexes = userTasks
                            .map((t, i) => (!t.repeating ? i : null))
                            .filter(i => i !== null);

                        // Mark all specified tasks done
                        doneVisibleIndices.forEach(doneVisibleIndex => {
                            const doneIndex = nonRepeatingIndexes[doneVisibleIndex];
                            if (doneIndex !== undefined) {
                                userTasks[doneIndex] = { ...userTasks[doneIndex], done: true, current: false };
                            }
                        });

                        // Remove old newCurrent logic, instead set first not done as current
                        const firstNotDone = userTasks.findIndex(t => !t.done && !t.repeating);
                        userTasks.forEach(t => (t.current = false));
                        if (firstNotDone !== -1) {
                            userTasks[firstNotDone].current = true;
                        }
                        // else leave all current false

                        return {
                            ...prevTasks,
                            [usernameKey]: {
                                ...userData,
                                tasks: userTasks,
                            },
                        };
                    });
                }

                if (cmd === "!undone") {
                    const undoneTasksStr = parts.slice(1).join(" ");
                    if (!undoneTasksStr) return;

                    const undoneVisibleIndices = undoneTasksStr
                        .split(";")
                        .map(t => parseInt(t.trim()) - 1)
                        .filter(i => !isNaN(i));
                    if (undoneVisibleIndices.length < 1) return;

                    setTasks((prevTasks) => {
                        const userData = prevTasks[usernameKey];
                        if (!userData) return prevTasks;

                        const userTasks = [...userData.tasks];

                        // Map visible (non-repeating) index to actual index
                        const nonRepeatingIndexes = userTasks
                        .map((t, i) => (!t.repeating ? i : null))
                        .filter(i => i !== null);

                        // Mark all specified tasks undone
                        undoneVisibleIndices.forEach(visibleIndex => {
                            const actualIndex = nonRepeatingIndexes[visibleIndex];
                            if (actualIndex !== undefined) {
                                userTasks[actualIndex] = { ...userTasks[actualIndex], done: false, current: false };
                            }
                        });

                        const hasCurrent = userTasks.some(t => t.current);
                        if (!hasCurrent) {
                            const firstUndone = userTasks.findIndex(t => !t.done && !t.repeating);
                            if (firstUndone !== -1) {
                                userTasks.forEach(t => (t.current = false));
                                userTasks[firstUndone].current = true;
                            }
                        }

                        return {
                            ...prevTasks,
                            [usernameKey]: {
                                ...userData,
                                tasks: userTasks,
                            },
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
                        Object.entries(tasks).map(([userKey, userData], index) => (
                            <div
                                key={userKey}
                                className={`tasklist-user ${index > 0 ? "with-divider" : ""}`}
                            >
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