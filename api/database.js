import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

export default async (req, res) => {
    // ⚠️ 注意：请确保 Vercel 环境变量里的名字也是 ENV_NOTION_TOKEN 和 ENV_DATABASE_ID
    // 如果你在 Vercel 里填的是 NOTION_TOKEN，请把下面改成 process.env.NOTION_TOKEN
    const token = process.env.ENV_NOTION_TOKEN;
    const databaseId = process.env.ENV_DATABASE_ID;
    const propertyName = process.env.ENV_CHECKBOX_PROPERTY_NAME; 

    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: {
                    property: "Date",
                    date: {
                        is_not_empty: true
                    }
                }
            })
        });
        
        const data = await response.json();

        // 调试日志
        console.log("Notion API 状态码:", response.status);
        if (data.results && data.results.length > 0) {
             console.log("第一条数据示例:", JSON.stringify(data.results[0].properties, null, 2));
        } else {
             console.log("⚠️ Notion 返回了空数组，可能是 DatabaseID 错或者没写日记");
        }

        // --- 修复点在这里：之前这里有两个 if，现在删掉了一个 ---
        if (!response.ok) {
            throw new Error(`Notion API error: ${response.status} ${JSON.stringify(data)}`);
        }

        const processedData = processData(data.results, propertyName);
        
        // 设置缓存控制，避免 Vercel 频繁请求 (可选)
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        res.json(processedData);

    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: error.message });
    }
};

const processData = (data, propertyName) => {
    const dataMap = new Map();

    data.forEach(item => {
        if (item.properties.Date && item.properties.Date.date && item.properties[propertyName]) {
            const dateStr = item.properties.Date.date.start;
            
            // 读取数字属性
            const count = item.properties[propertyName].number || 0;
            
            if (dataMap.has(dateStr)) {
                dataMap.set(dateStr, dataMap.get(dateStr) + count);
            } else {
                dataMap.set(dateStr, count);
            }
        }
    });

    return Array.from(dataMap).map(([date, count]) => ({ date, count }));
};
