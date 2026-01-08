import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

export default async (req, res) => {
    const token = process.env.ENV_NOTION_TOKEN;
    const databaseId = process.env.ENV_DATABASE_ID;
    // 这里我们复用这个环境变量名，但实际上填的是你的 "Word Count" 属性名
    const propertyName = process.env.ENV_CHECKBOX_PROPERTY_NAME; 

    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28', // 建议升级一下 API 版本
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // 过滤掉没有日期的条目，减少数据量
                filter: {
                    property: "Date",
                    date: {
                        is_not_empty: true
                    }
                }
            })
        });
        const data = await response.json();

        // 🔥 新增这行调试代码
        console.log("Notion返回的第一条数据:", JSON.stringify(data.results[0]?.properties, null, 2)); 

        if (!response.ok) {

        if (!response.ok) {
            throw new Error(`Notion API error: ${response.status} ${JSON.stringify(data)}`);
        }

        const processedData = processData(data.results, propertyName);
        res.json(processedData);
    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: error.message });
    }
};

const processData = (data, propertyName) => {
    const dataMap = new Map();

    data.forEach(item => {
        // 确保有 Date 属性，且有我们要读的 Word Count 属性
        if (item.properties.Date && item.properties.Date.date && item.properties[propertyName]) {
            const dateStr = item.properties.Date.date.start; // 直接拿 YYYY-MM-DD
            
            // 核心修改：读取 number 属性，如果没有值则默认为 0
            const count = item.properties[propertyName].number || 0;
            
            // 如果同一天有多条日记，把字数加起来
            if (dataMap.has(dateStr)) {
                dataMap.set(dateStr, dataMap.get(dateStr) + count);
            } else {
                dataMap.set(dateStr, count);
            }
        }
    });

    // 返回格式：{ date: "2026-01-06", count: 1071 }
    return Array.from(dataMap).map(([date, count]) => ({ date, count }));
};

